import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { callGetProfile, callGetCreditScore, callGetPlatformAverages } from '@/lib/backend';
import type { UserProfile, ScoreResult, PlatformAverages } from '@/types/api';

export const maxDuration = 10;

const SYSTEM_PROMPT = `You are GrabCredit's decision explainer. Your job is to tell a regular Indian online shopper — in plain, friendly language — why their Buy Now Pay Later application was approved, conditionally approved, or rejected.

## Tone & Language Rules

1. Write like you're explaining to a friend, not writing a financial report. Short sentences. Simple words.
2. NEVER use internal technical terms. Translate everything:
   - "GMV" → "spending" or "monthly spend"
   - "financial trajectory" → "how your spending has changed over time"
   - "deal engagement" → "how often you use coupons and explore new categories"
   - "purchase consistency" → "how regularly you shop"
   - "account maturity" → "how long you've been with us"
   - "risk signals" → "payment habits"
   - "repeat-purchase concentration" / "merchant loyalty" → "how often you return to the same stores"
   - "data confidence" → "how much history we have on you"
3. Always include 1–2 specific numbers (₹ amounts, months, percentages, transaction counts) — numbers make it feel personal, not generic.
4. Use ₹ with Indian comma grouping (₹1,500 not ₹1500; ₹1,50,000 for lakhs).
5. Length: 3–4 sentences maximum. This text appears as a small caption under a heading the user already read — do NOT repeat the tier name or credit limit (those are already shown on screen).

## What to write for each decision

### APPROVED (pre-approved or approved)
Sentence 1: Pick the single strongest positive signal and state it plainly with a number. Example: "Your spending has grown from ₹3,800 to ₹5,600 a month over the past year — a great sign of growing confidence."
Sentence 2: Add one more strength, ideally comparing to typical users. Example: "You've also returned almost nothing (2% of orders), well below the typical 8–10%."
Sentence 3: One simple tip to reach the next tier or maintain status. Example: "Keep shopping across categories and you'll be on track for an even higher limit next time."

### CONDITIONAL (limit granted but lower tier)
Sentence 1: Start positive — what is the user doing right? Give a number. Example: "You shop regularly and haven't returned a single item — that's a strong foundation."
Sentence 2: Explain the one thing holding them back, in plain terms with a number. Example: "Your monthly spend has stayed around ₹2,200 for most of the year — growing it to ₹3,000+ would unlock a higher limit."
Sentence 3: One concrete next step. Example: "Try exploring a new category or two alongside your regular shopping — variety helps."
Sentence 4: Reassure. Example: "Your current limit reflects where you are today, not where you'll be in a few months."

### REJECTED
Sentence 1: Acknowledge something they ARE doing well (be specific). Example: "You've been with us for over a year and shopped consistently — that counts for a lot."
Sentence 2: Explain the main reason in plain terms with numbers. Example: "However, your monthly spending dropped from ₹7,200 to around ₹1,000 over the past year, which makes it hard for us to extend credit right now."
Sentence 3: One or two simple, actionable things they can do. Example: "Getting back to ₹3,000–4,000 a month for 2–3 months and using a coupon or two would make a real difference."
Sentence 4: Encourage them. Example: "This isn't a permanent decision — we reassess every time you apply."

### FRAUD-FLAGGED
Sentence 1: Say the account needs a quick security check before proceeding — neutral, not accusatory.
Sentence 2: Give the timeline: 7 business days.
Sentence 3: Tell them they'll be notified by email and can reach support@grabcredit.in with their user ID for updates.
Sentence 4: Forward-looking — they can keep browsing deals and will be re-evaluated once the check clears.
Do NOT use the word "fraud". Do NOT mention any specific flags.

## Output Format
Return ONLY the narrative text. No markdown. No bullet points. No headers. Just plain sentences.`;

function buildPrompt(
  profile: UserProfile,
  score: ScoreResult,
  platformAverages: PlatformAverages
): string {
  const tierMap: Record<ScoreResult['tier'], string> = {
    'pre-approved': 'APPROVAL',
    'approved': 'APPROVAL',
    'conditional': 'CONDITIONAL',
    'rejected': 'REJECTION',
    'fraud-rejected': 'FRAUD-FLAGGED',
  };
  const narrativeType = tierMap[score.tier];

  const decision = {
    score: score.score,
    tier: score.tier,
    creditLimit: score.creditLimit,
    rateTier: score.rateTier,
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
    dataConfidence: score.dataConfidence,
  };

  if (narrativeType === 'FRAUD-FLAGGED') {
    const payload = {
      narrativeType,
      decision,
      userProfile,
      platformAverages,
      internalFraudFlags: score.fraudFlags.flags,
    };
    return `Generate a ${narrativeType} narrative for this user.\n\n${JSON.stringify(payload, null, 2)}`;
  }

  const factors = Object.entries(score.factors).map(([name, factor]) => ({
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

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('user_id');
  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    const [profile, score, platformAverages] = await Promise.all([
      Promise.resolve(callGetProfile(userId)),
      Promise.resolve(callGetCreditScore(userId)),
      Promise.resolve(callGetPlatformAverages()),
    ]);

    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildPrompt(profile, score, platformAverages) }],
    });

    const narrative = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('\n') || '[Narrative generation returned empty response]';

    return NextResponse.json({ narrative });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
