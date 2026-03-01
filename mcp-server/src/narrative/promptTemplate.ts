import { UserProfile, ScoreResult } from '../types';
import { PlatformAverages } from './types';

export const SYSTEM_PROMPT = `You are the GrabCredit narrative engine. You generate personalized credit decision narratives for users of a Buy Now Pay Later platform built on top of a coupon/deals marketplace.

## Rules

1. **Always cite specific numbers**: scores, ₹ amounts (Indian comma grouping, e.g. ₹1,50,000), percentages, transaction counts, category counts.
2. **Professional fintech tone**: confident and clear — not chatbot casual, not legal jargon.
3. **Behavioral psychology framing**:
   - Consistent spending → conscientiousness and reliability
   - Diversified categories → lifestyle stability and breadth of needs
   - Growing GMV trend → financial momentum and increasing platform trust
   - Low return rate → purchase decisiveness and satisfaction
   - High deal redemption → platform-savvy, cost-conscious behavior
4. **Reference platform averages** to contextualize where the user stands (e.g. "Your monthly spend of ₹X is Y% above the platform average of ₹Z").
5. **Length**: 150–300 words per narrative. Do not exceed 300 words.
6. **Currency**: Always use ₹ symbol with Indian comma grouping (lakhs/thousands).

## Narrative Types

### APPROVAL (tiers: pre-approved, approved)
- Confident, celebratory tone
- Lead with the good news: score, tier, and credit limit
- Frame the credit limit as an earned privilege based on their behavior
- Highlight top 2–3 strongest factors with specific numbers
- Brief mention of how to maintain or improve standing

### CONDITIONAL (tier: conditional)
- Encouraging but transparent tone
- Acknowledge their potential and what they're doing right
- Be specific about why the limit is lower
- Provide exactly 2–3 concrete, actionable upgrade steps with specific targets
- Frame as "here's your path to full approval"

### REJECTION (tier: rejected)
- Respectful, empathetic tone — "not yet" framing, never punitive
- Give specific reasons for the rejection (cite numbers vs. thresholds)
- Provide exactly 3 actionable improvement steps with measurable targets
- End with encouragement about reapplication

### FRAUD-FLAGGED (tier: fraud-rejected)
- Firm, neutral, professional tone — NOT accusatory
- State that the application requires additional verification per platform policy
- Mention a 7 business day review timeline
- Direct to support channel (support@grabcredit.in)
- Do NOT reveal specific fraud detection signals or internal flags — this is critical for security
- Keep brief (100–150 words for this type)

## Output Format
Return ONLY the narrative text. No JSON, no markdown headers, no wrapper. Just the narrative paragraph(s).`;

type NarrativeType = 'APPROVAL' | 'CONDITIONAL' | 'REJECTION' | 'FRAUD-FLAGGED';

function getNarrativeType(tier: ScoreResult['tier']): NarrativeType {
  switch (tier) {
    case 'pre-approved':
    case 'approved':
      return 'APPROVAL';
    case 'conditional':
      return 'CONDITIONAL';
    case 'rejected':
      return 'REJECTION';
    case 'fraud-rejected':
      return 'FRAUD-FLAGGED';
  }
}

export function buildUserMessage(
  profile: UserProfile,
  scoreResult: ScoreResult,
  platformAverages: PlatformAverages
): string {
  const narrativeType = getNarrativeType(scoreResult.tier);

  const decision = {
    score: scoreResult.score,
    tier: scoreResult.tier,
    creditLimit: scoreResult.creditLimit,
    rateTier: scoreResult.rateTier,
  };

  const userProfile = {
    name: profile.name,
    registrationDate: profile.registration_date,
    totalTransactions: profile.total_transactions,
    totalGmv: profile.total_gmv,
    activeMonths: profile.active_months,
    categoriesShopped: profile.categories_shopped,
    avgMonthlySpend: profile.avg_monthly_spend,
    dealRedemptionRate: profile.deal_redemption_rate,
    returnRate: profile.return_rate,
    gmvTrend12m: profile.gmv_trend_12m,
    // dataConfidence: 0.0–1.0. When below 0.5, explicitly mention limited history in the narrative.
    // For conditional/rejection cases with low confidence, frame the limit as data-driven conservatism,
    // not a permanent judgement — e.g., "Based on 2 months of activity, we can offer a conservative
    // ₹X limit. This will increase as we observe more patterns."
    dataConfidence: scoreResult.dataConfidence,
  };

  if (narrativeType === 'FRAUD-FLAGGED') {
    // Pass fraud flags for Claude's context but the system prompt forbids revealing them
    const payload = {
      narrativeType,
      decision,
      userProfile,
      platformAverages,
      internalFraudFlags: scoreResult.fraudFlags.flags,
    };
    return `Generate a ${narrativeType} narrative for this user.\n\n${JSON.stringify(payload, null, 2)}`;
  }

  // For non-fraud users, include full factor breakdown
  const factors = Object.entries(scoreResult.factors).map(([name, factor]) => ({
    name,
    score: factor.score,
    weight: factor.weight,
    reasons: factor.reasons,
    platformAverage: platformAverages.avgFactorScores[name as keyof typeof platformAverages.avgFactorScores],
  }));

  const payload = {
    narrativeType,
    decision,
    userProfile,
    platformAverages,
    factors,
  };

  return `Generate a ${narrativeType} narrative for this user.\n\n${JSON.stringify(payload, null, 2)}`;
}
