import { UserProfile, Transaction, ScoreResult, FraudResult } from '../types';
import { checkFraudFlags } from './fraudDetection';
import {
  calcPurchaseConsistency,
  calcDealEngagement,
  calcFinancialTrajectory,
  calcRiskSignals,
  calcAccountMaturity,
  linearRegression,
} from './factors';

/** Configurable current date for all calculations */
export const CURRENT_DATE = new Date('2026-02-26');

/**
 * Minimum transactions required to run the full scoring pipeline.
 * Below this threshold we have insufficient signal to make a meaningful decision —
 * returning a neutral dampened score of 500 (conditional) for a zero-transaction
 * user would be a false positive and a real credit risk.
 */
const MINIMUM_TRANSACTIONS_FOR_SCORING = 3;

/**
 * Data confidence dampener.
 *
 * Users with sparse history shouldn't receive extreme scores — either falsely high
 * (which would approve a fraudster with 5 lucky transactions) or falsely low
 * (which would reject a genuine new user). The dampener compresses all factor scores
 * toward 50 (neutral) proportional to how little data we have.
 *
 * Confidence reaches 1.0 at 200 transactions AND 12 active months. Below that,
 * the geometric mean of both factors prevents gaming (e.g., 500 transactions in
 * a single month still gets penalised for lack of temporal history).
 */
function computeConfidence(profile: UserProfile): number {
  const txnFactor = Math.sqrt(Math.min(profile.total_transactions, 200) / 200);
  const monthFactor = Math.sqrt(Math.min(profile.active_months, 12) / 12);
  return Math.min(1.0, txnFactor * monthFactor);
}

function dampenScore(rawScore: number, confidence: number): number {
  return 50 + (rawScore - 50) * confidence;
}

/**
 * Compute the normalized slope of the GMV trend for decline penalty.
 */
function computeNormalizedSlope(gmvTrend: number[]): number {
  const nonZero = gmvTrend.filter(v => v > 0);
  if (nonZero.length < 2) return 0;
  const { slope } = linearRegression(nonZero);
  const m = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
  return m > 0 ? slope / m : 0;
}

/**
 * Interpolate a value linearly between two ranges.
 */
function interpolate(score: number, minScore: number, maxScore: number, minVal: number, maxVal: number): number {
  const t = Math.max(0, Math.min(1, (score - minScore) / (maxScore - minScore)));
  return Math.round(minVal + t * (maxVal - minVal));
}

/**
 * Map score + fraud result to tier, credit limit, and rate tier.
 */
function mapScoreToDecision(score: number, fraudResult: FraudResult): {
  tier: ScoreResult['tier'];
  creditLimit: number;
  rateTier: number;
} {
  if (fraudResult.action === 'auto-reject') {
    return { tier: 'fraud-rejected', creditLimit: 0, rateTier: 0 };
  }
  if (score >= 800) {
    return { tier: 'pre-approved', creditLimit: interpolate(score, 800, 1000, 50000, 100000), rateTier: 1 };
  }
  if (score >= 600) {
    return { tier: 'approved', creditLimit: interpolate(score, 600, 799, 15000, 50000), rateTier: 2 };
  }
  if (score >= 400) {
    return { tier: 'conditional', creditLimit: interpolate(score, 400, 599, 5000, 15000), rateTier: 3 };
  }
  return { tier: 'rejected', creditLimit: 0, rateTier: 0 };
}

/**
 * Main scoring entry point.
 *
 * Algorithm overview:
 *  1. Fraud detection runs first and can short-circuit the entire pipeline.
 *  2. Five behavioral factors are scored independently (0–100 each).
 *  3. A confidence dampener compresses scores toward 50 for data-sparse users.
 *  4. A weighted sum produces a 0–100 composite, scaled to 0–1000.
 *  5. A decline modifier further penalises users with strongly negative GMV trends,
 *     because trajectory captures something the static factor scores miss.
 *  6. The final score maps to a tier, credit limit, and rate tier.
 *
 * Factor weights:
 *   Purchase Consistency  25% — frequency/regularity; strongest predictor of reliability
 *   Deal Engagement       20% — coupon usage + category diversification; platform health signal
 *   Financial Trajectory  20% — GMV trend direction; forward-looking risk indicator
 *   Risk Signals          20% — returns + payment mode; behavioural risk flags
 *   Account Maturity      15% — history depth; confidence in the other factors
 */
export function calculateCreditScore(
  profile: UserProfile,
  transactions: Transaction[],
  currentDate: Date = CURRENT_DATE
): ScoreResult {
  // Step 1: Fraud detection (runs first)
  const fraudFlags = checkFraudFlags(profile, transactions, currentDate);

  // If auto-rejected by fraud, skip scoring entirely
  if (fraudFlags.action === 'auto-reject') {
    const emptyFactor = { score: 0, weight: 0, reasons: ['Skipped — fraud auto-reject'] };
    return {
      score: 0,
      tier: 'fraud-rejected',
      creditLimit: 0,
      rateTier: 0,
      dataConfidence: 0,
      factors: {
        purchaseConsistency: { ...emptyFactor, weight: 0.25 },
        dealEngagement: { ...emptyFactor, weight: 0.20 },
        financialTrajectory: { ...emptyFactor, weight: 0.20 },
        riskSignals: { ...emptyFactor, weight: 0.20 },
        accountMaturity: { ...emptyFactor, weight: 0.15 },
      },
      fraudFlags,
    };
  }

  // Step 2: Guard against insufficient data.
  // The confidence dampener pulls all scores toward 50 (neutral) when data is sparse.
  // With zero transactions, this produces a falsely "conditional" score of 500 —
  // which would grant credit to a dormant account with no purchase history.
  // We reject explicitly rather than trusting the dampener to handle this edge case.
  if (profile.total_transactions < MINIMUM_TRANSACTIONS_FOR_SCORING) {
    const insufficientFactor = {
      score: 0,
      weight: 0,
      reasons: [`Insufficient data: only ${profile.total_transactions} transaction(s) recorded`],
    };
    return {
      score: 0,
      tier: 'rejected',
      creditLimit: 0,
      rateTier: 0,
      dataConfidence: 0,
      factors: {
        purchaseConsistency: { ...insufficientFactor, weight: 0.25 },
        dealEngagement: { ...insufficientFactor, weight: 0.20 },
        financialTrajectory: { ...insufficientFactor, weight: 0.20 },
        riskSignals: { ...insufficientFactor, weight: 0.20 },
        accountMaturity: { ...insufficientFactor, weight: 0.15 },
      },
      fraudFlags,
    };
  }

  // Step 4: Calculate raw factor scores
  const purchaseConsistency = calcPurchaseConsistency(profile, transactions, currentDate);
  const dealEngagement = calcDealEngagement(profile, transactions, currentDate);
  const financialTrajectory = calcFinancialTrajectory(profile, transactions, currentDate);
  const riskSignals = calcRiskSignals(profile, transactions, currentDate);
  const accountMaturity = calcAccountMaturity(profile, transactions, currentDate);

  // Step 5: Apply confidence dampener
  const confidence = computeConfidence(profile);

  const dampenedConsistency = dampenScore(purchaseConsistency.score, confidence);
  const dampenedDeal = dampenScore(dealEngagement.score, confidence);
  const dampenedTrajectory = dampenScore(financialTrajectory.score, confidence);
  const dampenedRisk = dampenScore(riskSignals.score, confidence);
  const dampenedMaturity = dampenScore(accountMaturity.score, confidence);

  // Step 6: Weighted sum → scale to 0-1000
  let weightedSum =
    dampenedConsistency * 0.25 +
    dampenedDeal * 0.20 +
    dampenedTrajectory * 0.20 +
    dampenedRisk * 0.20 +
    dampenedMaturity * 0.15;

  let finalScore = Math.round(weightedSum * 10);

  // Step 7: Decline modifier — if trajectory slope is strongly negative, scale down
  const normalizedSlope = computeNormalizedSlope(profile.gmv_trend_12m);
  if (normalizedSlope < -0.03) {
    const declinePenalty = Math.max(0.50, 1.0 + normalizedSlope * 5);
    finalScore = Math.round(finalScore * declinePenalty);
    purchaseConsistency.reasons.push(`Decline penalty applied: ×${declinePenalty.toFixed(2)}`);
  }

  finalScore = clamp(finalScore, 0, 1000);

  // Step 8: Map to tier
  const { tier, creditLimit, rateTier } = mapScoreToDecision(finalScore, fraudFlags);

  return {
    score: finalScore,
    tier,
    creditLimit,
    rateTier,
    dataConfidence: Math.round(confidence * 100) / 100,
    factors: {
      purchaseConsistency,
      dealEngagement,
      financialTrajectory,
      riskSignals,
      accountMaturity,
    },
    fraudFlags,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
