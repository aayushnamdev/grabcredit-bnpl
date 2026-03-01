# Scoring Logic — Quick Reference

Full explanation with factor rationale is in the main [README](../README.md#scoring-model-why-these-factors).
Source code: [`mcp-server/src/scoring/`](../mcp-server/src/scoring/)

---

## Factor Weights

| Factor | Weight | Core Signal | Business Rationale |
|--------|--------|-------------|-------------------|
| **Purchase Consistency** | 25% | Active months ratio + spend volatility + recency | Consistent spending is the strongest behavioral proxy for financial stability. Captures *conscientiousness*. |
| **Deal Engagement Quality** | 20% | Coupon usage (bell curve) + category breadth + merchant loyalty | Platform-specific signal: how intentionally the user engages with the deal ecosystem. Breadth of categories correlates with financial planning breadth. |
| **Financial Trajectory** | 20% | Linear regression on 12-month GMV trend | Direction matters more than absolute level. A user trending up at ₹2K/month outranks one declining from ₹10K/month. |
| **Risk Signals** | 20% | Category-adjusted return rate + payment mode + high-value concentration | Traditional credit bureaus miss this entirely. COD-heavy payments and high return rates are real default risk signals in e-commerce. |
| **Account Maturity** | 15% | Transaction bracket + log-scale count + active ratio | Lowest weight because it's partially collinear with Consistency. Old account + inactive = no value. |

---

## Scoring Pipeline

```
User Profile + Transactions
         │
         ▼
  ┌─────────────────┐
  │  Fraud Detection │  ← Runs first. Auto-reject short-circuits everything below.
  └────────┬────────┘
           │ (if not fraud)
           ▼
  ┌─────────────────┐
  │ Minimum Txn Guard│  ← Reject if < 3 transactions (prevents false conditional)
  └────────┬────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────────┐
  │              5 Factor Calculators (0–100 each)       │
  │  PurchaseConsistency · DealEngagement               │
  │  FinancialTrajectory · RiskSignals · AccountMaturity│
  └────────┬────────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────┐
  │  Confidence Dampener         │  ← Compresses toward 50 for sparse data
  │  confidence = √(txns/200)   │     confidence = √(txns/200) × √(months/12)
  │               × √(months/12)│     score = 50 + (raw - 50) × confidence
  └────────┬────────────────────┘
           │
           ▼
  ┌─────────────────┐
  │  Weighted Sum    │  ← 0–100 composite → ×10 → 0–1000
  └────────┬────────┘
           │
           ▼
  ┌──────────────────────────────┐
  │  Decline Modifier (optional) │  ← If GMV slope < -0.03, multiply by 0.5–1.0
  └────────┬─────────────────────┘
           │
           ▼
  ┌──────────────────┐
  │  Tier + Limit     │  ← Linearly interpolated within each band
  └──────────────────┘
```

---

## Score → Decision Mapping

| Score Range | Tier | Credit Limit | Rate | EMI Tenures |
|-------------|------|-------------|------|-------------|
| 800–1000 | Pre-Approved | ₹50K–₹1L | 0% interest + ₹299 flat | 3, 6, 9, 12 months |
| 600–799 | Approved | ₹15K–₹50K | 14% APR | 3, 6, 9 months |
| 400–599 | Conditional | ₹5K–₹15K | 20% APR | 3, 6 months |
| < 400 | Rejected | — | — | — |
| Any (fraud) | Fraud-Rejected | — | — | — |

Limits are linearly interpolated within each band (score 700 → higher limit than 620).

---

## Fraud Detection

Runs before scoring. Any `auto-reject` flag skips the scoring engine entirely.

| # | Flag | Trigger | Action |
|---|------|---------|--------|
| 1 | New Account | Account < 7 days old | Auto-reject |
| 2 | Velocity Spike | > ₹20,000 GMV in first 48 hours post-registration | Review |
| 3 | Category Jump | > 80% GMV in one category + high-value outlier in a different category | Review |
| 4 | Single-Pattern Combo | < 30 days + single payment mode + single category + 0% coupon usage | Auto-reject |
| 5 | Electronics Concentration | > 80% GMV in Electronics + < 10 total transactions | Monitor |
| 6 | Dormant Account | Account > 90 days old + 0 total transactions | Review |

**Why Flag 6 (Dormant Account) is different from Flag 1 (New Account):**
A new account is expected to have no history. A 6-month-old account with zero transactions is a different risk profile — the user had ample time to build behavioral history and didn't. This pattern can indicate account takeover, synthetic identity, or speculative account creation for future fraud.

---

## Data Confidence

Users with sparse history receive a confidence-dampened score (compressed toward 500/neutral):

```
confidence = sqrt(min(transactions, 200) / 200)
           × sqrt(min(active_months, 12) / 12)

final_score = 50 + (raw_score - 50) × confidence
```

- **confidence = 1.0**: 200+ transactions AND 12+ active months
- **confidence = 0.5**: ~50 transactions, ~3 active months
- **confidence = 0.0**: zero transactions (returns rejected immediately via min-txn guard)

The geometric mean prevents gaming (e.g., 500 transactions in 1 month still scores poorly on the month factor).

---

## The 5 Personas

| Persona | Archetype | Score | Tier | Key Signals |
|---------|-----------|-------|------|-------------|
| Priya Sharma (user_001) | Power User | ~927 | Pre-Approved | 214 txns, 18 active months, 5 categories, 0.55 redemption, 1.8% returns |
| Rahul Verma (user_002) | Steady Spender | ~672 | Approved | 80 txns, flat GMV, mostly Food + Fashion, 5% returns |
| Ananya Iyer (user_003) | New But Promising | ~489 | Conditional | 25 txns, 3 months, strong upward trajectory, single category |
| Vikram Singh (user_004) | Declining User | ~312 | Rejected | 60 txns, GMV -40% over 6 months, rising returns, narrowing categories |
| Ghost User (user_005) | Suspicious New | 0 | Fraud-Rejected | 3 days old, 2 large electronics purchases, COD only, 0% coupons |
