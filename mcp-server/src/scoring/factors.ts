import { UserProfile, Transaction, FactorResult } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

export function linearRegression(values: number[]): { slope: number; r2: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, r2: 0 };
  const xs = values.map((_, i) => i);
  const mx = mean(xs);
  const my = mean(values);
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = values[i] - my;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const slope = denX === 0 ? 0 : num / denX;
  const r2 = (denX === 0 || denY === 0) ? 0 : (num * num) / (denX * denY);
  return { slope, r2 };
}

// ─── Factor 1: Purchase Consistency (weight: 0.25) ───────────────────
//
// The highest-weighted factor. In behavioural economics, spending regularity is
// a stronger proxy for financial conscientiousness than total spend volume.
// A user spending ₹3,000/month for 12 consecutive months is a better credit bet
// than one who spends ₹36,000 in a single burst — same GMV, very different risk.
//
// Sub-factors:
//   Active months ratio (40%) — what fraction of eligible months had activity?
//   Coefficient of variation  (40%) — how volatile is monthly spend? Lower = better.
//   Recency                   (20%) — exponential decay: 30-day half-life.
//                                     Lapsed users lose eligibility quickly.

export function calcPurchaseConsistency(
  profile: UserProfile,
  _transactions: Transaction[],
  currentDate: Date
): FactorResult {
  const reasons: string[] = [];
  const regDate = new Date(profile.registration_date);
  const totalMonths = Math.max(1, monthsBetween(regDate, currentDate));

  // Sub-factor A: Active Months Ratio (40%)
  const ratio = Math.min(1, profile.active_months / totalMonths);
  const scoreA = clamp(ratio * 100, 0, 100);
  reasons.push(`Active months ratio: ${profile.active_months}/${totalMonths} = ${(ratio * 100).toFixed(0)}%`);

  // Sub-factor B: Coefficient of Variation of monthly spend (40%)
  const nonZeroMonths = profile.gmv_trend_12m.filter(v => v > 0);
  let scoreB: number;
  if (nonZeroMonths.length < 2) {
    scoreB = 100; // single month → no variation
    reasons.push('CV: single data point, defaulting to 100');
  } else {
    const cv = stddev(nonZeroMonths) / mean(nonZeroMonths);
    scoreB = clamp((1 - cv) * 100, 0, 100);
    reasons.push(`CV of monthly spend: ${cv.toFixed(2)} → score ${scoreB.toFixed(0)}`);
  }

  // Sub-factor C: Recency (20%)
  const lastTxnDate = new Date(profile.last_transaction_date);
  const daysSinceLastTxn = daysBetween(lastTxnDate, currentDate);
  const scoreC = 100 * Math.exp(-daysSinceLastTxn / 30);
  reasons.push(`Days since last txn: ${daysSinceLastTxn} → recency score ${scoreC.toFixed(0)}`);

  const score = 0.40 * scoreA + 0.40 * scoreB + 0.20 * scoreC;
  return { score: Math.round(score), weight: 0.25, reasons };
}

// ─── Factor 2: Deal Engagement Quality (weight: 0.20) ────────────────
//
// Unique to a deals platform: how a user engages with coupons and categories
// reveals their relationship with money and their lifestyle breadth.
//
// Sub-factors:
//   Coupon usage rate    (40%) — bell-curve model. The sweet spot is 40–60%:
//                                financially disciplined but not desperate.
//                                <20% = disengaged, >80% = extreme price sensitivity.
//   Category diversity   (40%) — users who shop across essential (Food, Health)
//                                AND discretionary (Fashion, Travel, Electronics)
//                                categories signal lifestyle stability.
//                                Single-category users score 35/100.
//                                Recent category narrowing is penalised — it can
//                                indicate financial stress or platform disillusion.
//   Merchant loyalty     (20%) — repeat purchases at the same merchants signal
//                                stable preferences, not impulsive browsing.

const COUPON_SCORING = [
  { min: 0.00, max: 0.20, score: 65 },
  { min: 0.20, max: 0.40, score: 80 },
  { min: 0.40, max: 0.60, score: 100 }, // sweet spot
  { min: 0.60, max: 0.80, score: 70 },
  { min: 0.80, max: 1.01, score: 40 },
];

function getCouponScore(rate: number): number {
  for (const bucket of COUPON_SCORING) {
    if (rate >= bucket.min && rate < bucket.max) return bucket.score;
  }
  return 50;
}

export function calcDealEngagement(
  profile: UserProfile,
  transactions: Transaction[],
  _currentDate: Date
): FactorResult {
  const reasons: string[] = [];
  const userTxns = transactions.filter(t => t.user_id === profile.user_id);

  // Sub-factor A: Coupon Usage Score (40%)
  const scoreA = getCouponScore(profile.deal_redemption_rate);
  reasons.push(`Coupon usage rate: ${(profile.deal_redemption_rate * 100).toFixed(0)}% → score ${scoreA}`);

  // Sub-factor B: Category Diversification (40%)
  const categoryGmv: Record<string, number> = {};
  let totalGmv = 0;
  for (const t of userTxns) {
    categoryGmv[t.merchant_category] = (categoryGmv[t.merchant_category] || 0) + t.transaction_amount;
    totalGmv += t.transaction_amount;
  }

  const essentialCats = new Set(['Food', 'Health']);
  const discretionaryCats = new Set(['Fashion', 'Travel', 'Electronics']);
  const categories = Object.keys(categoryGmv);
  const hasEssential = categories.some(c => essentialCats.has(c));
  const hasDiscretionary = categories.some(c => discretionaryCats.has(c));
  const numCats = categories.length;

  let scoreB: number;
  if (numCats >= 3 && hasEssential && hasDiscretionary) {
    scoreB = numCats >= 5 ? 100 : 85;
  } else if (numCats >= 2 && hasEssential && hasDiscretionary) {
    scoreB = 80;
  } else if (numCats >= 2 && hasEssential && !hasDiscretionary) {
    scoreB = 55;
  } else if (numCats >= 2 && !hasEssential && hasDiscretionary) {
    scoreB = 40;
  } else if (numCats === 1) {
    scoreB = 35;
  } else {
    scoreB = 50;
  }

  // For Vikram: 4 categories but recent trend is narrowing — check if recent txns are concentrated
  if (numCats >= 3) {
    const recentTxns = userTxns.slice(-Math.ceil(userTxns.length * 0.3));
    const recentCats = new Set(recentTxns.map(t => t.merchant_category));
    if (recentCats.size <= 2 && numCats >= 4) {
      scoreB = Math.max(35, scoreB - 20);
      reasons.push(`Category narrowing: ${numCats} historical → ${recentCats.size} recent categories`);
    }
  }
  reasons.push(`Categories: ${numCats} (essential: ${hasEssential}, discretionary: ${hasDiscretionary}) → score ${scoreB}`);

  // Sub-factor C: Merchant Loyalty (20%)
  const merchantTxnCount: Record<string, number> = {};
  for (const t of userTxns) {
    merchantTxnCount[t.merchant_name] = (merchantTxnCount[t.merchant_name] || 0) + 1;
  }
  const sortedMerchants = Object.entries(merchantTxnCount).sort((a, b) => b[1] - a[1]);
  const top3Count = sortedMerchants.slice(0, 3).reduce((sum, [_, c]) => sum + c, 0);
  const repeatRate = userTxns.length > 0 ? top3Count / userTxns.length : 0;
  const scoreC = Math.min(100, repeatRate * 120);
  reasons.push(`Merchant loyalty (top-3 repeat rate): ${(repeatRate * 100).toFixed(0)}% → score ${scoreC.toFixed(0)}`);

  const score = 0.40 * scoreA + 0.40 * scoreB + 0.20 * scoreC;
  return { score: Math.round(score), weight: 0.20, reasons };
}

// ─── Factor 3: Financial Trajectory (weight: 0.20) ───────────────────
//
// Direction matters more than position. This factor is deliberately forward-looking:
// a user trending up at ₹2K/month is a better credit bet than one declining from
// ₹10K/month, even if the second user has higher current GMV.
//
// Scoring logic (based on normalised linear regression slope):
//   slope > +0.03/mo  → Growing       (85) — confident spending expansion
//   slope -0.02–+0.03, low CV → Stable (100) — consistent spend is the gold standard
//   slope -0.02–+0.03, high CV → Erratic (50) — no clear trend, volatile
//   slope < -0.02/mo  → Declining     (exponential penalty, min 5)
//
// Additionally, a global decline modifier in engine.ts multiplies the FINAL score
// by up to 0.5× when the slope is strongly negative — because a declining user
// is a risk even if their other factors look good.

export function calcFinancialTrajectory(
  profile: UserProfile,
  _transactions: Transaction[],
  _currentDate: Date
): FactorResult {
  const reasons: string[] = [];
  const nonZero = profile.gmv_trend_12m.filter(v => v > 0);

  if (nonZero.length <= 1) {
    reasons.push('Insufficient data: ≤1 non-zero month → score 10');
    return { score: 10, weight: 0.20, reasons };
  }

  const { slope } = linearRegression(nonZero);
  const m = mean(nonZero);
  const cv = m > 0 ? stddev(nonZero) / m : 0;
  const normalizedSlope = m > 0 ? slope / m : 0;

  let score: number;
  if (normalizedSlope > 0.03) {
    score = 85;
    reasons.push(`Upward trend: normalized slope ${normalizedSlope.toFixed(3)}/mo → growth`);
  } else if (normalizedSlope >= -0.02 && cv < 0.15) {
    // Flat and consistent — check if absolute spend is low
    if (m < 2500) {
      score = 60;
      reasons.push(`Flat-low: stable but avg ₹${m.toFixed(0)}/mo is modest → score 60`);
    } else {
      score = 100;
      reasons.push(`Stable trajectory: low CV (${cv.toFixed(2)}), consistent spend → score 100`);
    }
  } else if (normalizedSlope >= -0.02) {
    score = 50;
    reasons.push(`Erratic: CV ${cv.toFixed(2)} with no clear trend → score 50`);
  } else {
    // Declining — use exponential penalty
    score = Math.max(5, Math.round(30 + 70 * Math.exp(normalizedSlope * 6)));
    reasons.push(`Declining: normalized slope ${normalizedSlope.toFixed(3)}/mo → score ${score}`);
  }

  return { score, weight: 0.20, reasons };
}

// ─── Factor 4: Risk Signals (weight: 0.20) ───────────────────────────
//
// Captures behavioural red flags that traditional credit bureaus never see.
//
// Sub-factors:
//   Category-adjusted return rate (40%) — a 15% return rate in Fashion is normal
//                                         (industry avg: 20%). The same rate in Food
//                                         is alarming (industry avg: 3%). We benchmark
//                                         per-category rather than using a flat threshold.
//
//   Payment mode risk             (40%) — Credit Card (100) > UPI (90) > Debit (85) >
//                                         NetBanking (70) > COD (30). A digital-platform
//                                         user who pays predominantly via COD signals
//                                         distrust of (or exclusion from) digital payments —
//                                         a meaningful proxy for financial access risk.
//
//   High-value concentration      (20%) — if the top 2 transactions represent >50% of
//                                         lifetime GMV, spending is lumpy and potentially
//                                         impulsive. We want to see broad, regular commerce.

const RETURN_BENCHMARKS: Record<string, { normal: number; warning: number }> = {
  Fashion:     { normal: 0.20, warning: 0.30 },
  Electronics: { normal: 0.08, warning: 0.15 },
  Food:        { normal: 0.03, warning: 0.07 },
  Travel:      { normal: 0.05, warning: 0.10 },
  Health:      { normal: 0.05, warning: 0.10 },
};

const PAYMENT_RISK_WEIGHTS: Record<string, number> = {
  'Credit Card': 100,
  'UPI': 90,
  'Debit Card': 85,
  'NetBanking': 70,
  'COD': 30,
};

export function calcRiskSignals(
  profile: UserProfile,
  transactions: Transaction[],
  _currentDate: Date
): FactorResult {
  const reasons: string[] = [];
  const userTxns = transactions.filter(t => t.user_id === profile.user_id);

  // Sub-factor A: Category-Adjusted Return Rate (40%)
  const catGmv: Record<string, number> = {};
  const catReturns: Record<string, number> = {};
  let totalGmv = 0;
  for (const t of userTxns) {
    catGmv[t.merchant_category] = (catGmv[t.merchant_category] || 0) + t.transaction_amount;
    totalGmv += t.transaction_amount;
    if (t.return_flag) {
      catReturns[t.merchant_category] = (catReturns[t.merchant_category] || 0) + t.refund_amount;
    }
  }

  let scoreA = 100;
  if (totalGmv > 0) {
    let weightedReturnScore = 0;
    let weightSum = 0;
    for (const [cat, gmv] of Object.entries(catGmv)) {
      const returnAmt = catReturns[cat] || 0;
      const returnRate = gmv > 0 ? returnAmt / gmv : 0;
      const benchmark = RETURN_BENCHMARKS[cat] || { normal: 0.10, warning: 0.20 };
      let catScore: number;
      if (returnRate <= benchmark.normal) {
        catScore = 100;
      } else if (returnRate <= benchmark.warning) {
        catScore = 60;
      } else {
        catScore = 20;
      }
      weightedReturnScore += catScore * gmv;
      weightSum += gmv;
    }
    scoreA = weightSum > 0 ? weightedReturnScore / weightSum : 100;
  }
  reasons.push(`Return rate analysis: overall ${(profile.return_rate * 100).toFixed(1)}% → score ${scoreA.toFixed(0)}`);

  // Sub-factor B: Payment Mode Risk (40%)
  let scoreB = 0;
  for (const [mode, pct] of Object.entries(profile.payment_mode_distribution)) {
    const weight = PAYMENT_RISK_WEIGHTS[mode] ?? 50;
    scoreB += pct * weight;
  }
  reasons.push(`Payment mode risk score: ${scoreB.toFixed(0)}`);

  // Sub-factor C: High-Value Concentration (20%)
  const sortedAmounts = userTxns.map(t => t.transaction_amount).sort((a, b) => b - a);
  const top2Sum = sortedAmounts.slice(0, 2).reduce((s, v) => s + v, 0);
  const topTxnPct = totalGmv > 0 ? top2Sum / totalGmv : 0;
  let scoreC: number;
  if (topTxnPct > 0.50) {
    scoreC = 30;
  } else if (topTxnPct > 0.30) {
    scoreC = 60;
  } else {
    scoreC = 100;
  }
  reasons.push(`Top-2 txn concentration: ${(topTxnPct * 100).toFixed(1)}% → score ${scoreC}`);

  const score = 0.40 * scoreA + 0.40 * scoreB + 0.20 * scoreC;
  return { score: Math.round(score), weight: 0.20, reasons };
}

// ─── Factor 5: Account Maturity (weight: 0.15) ───────────────────────
//
// The lowest-weighted factor — not because maturity doesn't matter, but because
// it's partially captured by Consistency and Trajectory. A mature account with
// no activity is worthless; this factor rewards the combination of age + density.
//
// Bracket scoring (50%) sets a hard floor: fewer than 15 transactions returns 5/100
// regardless of other metrics — insufficient data to make a confident decision.
// Above that, transaction count uses a log scale (diminishing returns: the 200th
// transaction adds less signal than the 20th) blended with active-month ratio.

export function calcAccountMaturity(
  profile: UserProfile,
  _transactions: Transaction[],
  currentDate: Date
): FactorResult {
  const reasons: string[] = [];
  const regDate = new Date(profile.registration_date);
  const totalMonths = Math.max(1, monthsBetween(regDate, currentDate));
  const txns = profile.total_transactions;
  const activeMonths = profile.active_months;

  // Bracket scoring
  let bracket: number;
  if (txns >= 50 && activeMonths >= 6) {
    bracket = 100;
  } else if (txns >= 25 && activeMonths >= 3) {
    bracket = 80;
  } else if (txns >= 15 && activeMonths >= 2) {
    bracket = 55;
  } else if (txns < 15) {
    bracket = 0;
    reasons.push(`Not eligible: only ${txns} transactions`);
    return { score: 5, weight: 0.15, reasons };
  } else {
    bracket = 35;
  }
  reasons.push(`Maturity bracket: ${txns} txns, ${activeMonths} active months → ${bracket}`);

  // Sub-factor: Transaction count score (diminishing returns)
  const txnScore = Math.min(100, Math.log2(Math.max(1, txns)) * 15);
  reasons.push(`Transaction count score: ${txnScore.toFixed(0)}`);

  // Sub-factor: Active months ratio
  const activeRatio = Math.min(1, activeMonths / totalMonths);
  const activeScore = activeRatio * 100;
  reasons.push(`Active ratio: ${activeMonths}/${totalMonths} = ${(activeRatio * 100).toFixed(0)}%`);

  // Blend: 50% bracket + 30% txn score + 20% active ratio
  const score = 0.50 * bracket + 0.30 * txnScore + 0.20 * activeScore;
  return { score: Math.round(score), weight: 0.15, reasons };
}
