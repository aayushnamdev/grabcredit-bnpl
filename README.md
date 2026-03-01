# GrabCredit — AI-Powered BNPL at Checkout

**Live demo → [https://grabcredit-bnpl.vercel.app](https://grabcredit-bnpl.vercel.app)**

GrabOn processes millions of coupon redemptions and deal transactions every year. Most Indians don't have a CIBIL score or a credit card — so traditional lenders can't serve them. But their shopping behavior tells a complete story: how regularly they buy, whether their spending is growing, how they pay, what categories they shop. **GrabCredit reads that story and turns it into an instant Buy Now, Pay Later decision at checkout.**

No credit bureau pull. No income verification. No paperwork. A shopper adds headphones to cart, clicks "Pay with GrabCredit," and in seconds sees a personalised EMI offer — plus an AI-written explanation of exactly why they qualify, or what they need to improve to get there.

![Checkout Widget](docs/assets/screenshot-checkout.png)

---

## How It Works

```
┌─────────────────────────────────────────────────────┐
│                    WHO USES IT                       │
│                                                      │
│   Shopper (Browser)        Claude Desktop            │
│         │                        │                   │
│         ▼                        │ stdio             │
│   Next.js Web App                │                   │
│   (Checkout Widget)              │                   │
│         │ API routes             │                   │
│         └──────────┬─────────────┘                   │
│                    ▼                                  │
│           ┌─────────────────┐                        │
│           │   MCP Server    │                        │
│           │  (8 tools)      │                        │
│           └────────┬────────┘                        │
│        ┌───────────┼───────────┐                     │
│        ▼           ▼           ▼                     │
│   Scoring      Fraud       PayU                      │
│   Engine       Detection   LazyPay                   │
│   (5 factors)  (6 flags)   mock / live               │
│        │                       │                     │
│        ▼                       ▼                     │
│  users.json            PayU Sandbox API              │
│  transactions.json     (PAYU_MODE=live)              │
│        │                                             │
│        ▼                                             │
│   Claude Narrative ──► Anthropic API                 │
│   Generator            (claude-sonnet)               │
└─────────────────────────────────────────────────────┘
```

![Architecture Diagram](docs/assets/diagram.png)

**Four things working together:**

1. **The MCP Server** is the brain. It's a Node.js server that exposes all the credit logic as tools — get a user's profile, calculate their score, check for fraud, generate EMI options. It can plug directly into Claude Desktop so you can ask questions like *"What's Priya's credit profile?"* and get live answers.

2. **The checkout widget** (Next.js web app) is what a merchant partner would embed at checkout. It calls the MCP server's tools directly and shows the result — an EMI offer, a rejection with an improvement path, or a fraud block.

3. **The scoring engine** reads GrabOn transaction data and produces a 0–1000 score from 5 behavioral factors. No black box — every factor is explainable and every decision has a reason.

4. **PayU LazyPay** handles the EMI disbursal. The integration runs in mock mode by default (works with no credentials) and can switch to the real PayU sandbox with one environment variable: `PAYU_MODE=live`.

---

## How the Credit Score Works

The scoring engine produces a 0–1000 score from five behavioral factors. Each factor was chosen because it maps to a measurable behavioral signal that traditional credit bureaus miss entirely.

### Factor 1: Purchase Consistency (25%)

**The insight:** Consistent monthly spending is the strongest proxy for financial stability. Someone who shops ₹3,000/month for 12 months straight is more creditworthy than someone who spends ₹36,000 in a single burst — even though the total is identical.

**How it works:**
- **Active months ratio** (40%): What fraction of months since registration had at least one transaction? A ratio of 0.9 means near-continuous engagement.
- **Coefficient of variation** (40%): How volatile is monthly spend? A CV below 0.3 means predictable behavior. High CV (erratic spending) gets penalized.
- **Recency** (20%): Exponential decay based on days since last transaction. A user who hasn't transacted in 60 days scores near zero on this sub-factor.

**Psychology framing:** This measures *conscientiousness* — the personality trait most predictive of financial reliability in behavioral economics literature.

### Factor 2: Deal Engagement Quality (20%)

**The insight:** On a deals platform, coupon usage isn't just about saving money — it reveals financial intentionality. But there's a sweet spot.

**How it works:**
- **Coupon redemption rate** (40%): A bell curve scoring model — 40–60% redemption is the sweet spot (financially smart), while >80% suggests extreme price sensitivity (higher default risk), and <20% suggests disengagement from the platform's core value.
- **Category diversification** (40%): Users who shop across both essential (Food, Health) and discretionary (Fashion, Travel, Electronics) categories score highest. Single-category users score 35/100. The engine also detects **category narrowing** — if a user historically shopped 4+ categories but recent transactions concentrate in 1–2, the score drops.
- **Merchant loyalty** (20%): Repeat purchases at the same merchants signal stable preferences, not impulsive browsing.

**Psychology framing:** This measures *revealed preference breadth* — diverse, intentional deal usage correlates with stable financial planning.

### Factor 3: Financial Trajectory (20%)

**The insight:** Direction matters more than position. A user trending upward at ₹2,000/month is a better credit bet than a user declining from ₹10,000/month — even if the second user has higher total spend.

**How it works:**
- Linear regression on the non-zero months of the 12-month GMV trend
- Normalized slope (slope / mean): `>0.03` = growth (score 85), `-0.02 to +0.03` with low CV = stable (score 100), `< -0.02` = declining (exponential penalty)
- An additional **decline modifier** at the engine level: if the normalized slope is below -0.03, the entire final score is multiplied by a penalty factor (down to 0.5×)

**Why stable > growing:** A user spending ₹8,000/month consistently for a year with low variance is demonstrating the kind of predictability lenders love. Growth is good, but stability is better — it's a feature, not a coincidence.

### Factor 4: Risk Signals (20%)

**The insight:** Returns and payment methods are behavioral risk indicators that traditional scoring completely ignores.

**How it works:**
- **Category-adjusted return rate** (40%): A 15% return rate in Fashion is normal (industry: 20%). The same rate in Food is alarming (industry: 3%). The engine benchmarks per-category rather than using a blanket threshold.
- **Payment mode risk** (40%): Credit card (100) > UPI (90) > Debit Card (85) > NetBanking (70) > COD (30). A user who pays primarily via COD on a digital platform signals they don't trust or don't have access to digital payment — a real risk indicator for BNPL.
- **High-value concentration** (20%): If two transactions account for >50% of total GMV, that's a red flag — it suggests lumpy, potentially impulsive purchasing rather than regular commerce.

### Factor 5: Account Maturity (15%)

**The insight:** Account age alone is a weak signal. Account age *combined with activity density* is a strong one.

**How it works:**
- **Bracket scoring** (50%): ≥50 transactions + ≥6 active months = 100. Below 15 transactions = automatic 5/100 (insufficient data).
- **Transaction count** (30%): Log-scale (diminishing returns — the 200th transaction adds less signal than the 20th).
- **Active ratio** (20%): Active months / total months since registration.

### Confidence Dampener

Users with sparse data shouldn't get extreme scores. The engine applies a confidence factor based on `sqrt(min(txns, 200)/200) × sqrt(min(activeMonths, 12)/12)`. This pulls scores toward 50 (neutral) for users with limited history, preventing both false approvals and unfair rejections.

### Fraud Detection (Binary Override)

Before scoring even begins, the fraud engine runs five checks:

| Flag | Trigger | Action |
|------|---------|--------|
| New Account | Account < 7 days old | Auto-reject |
| Velocity Spike | > ₹20,000 spent in first 48 hours | Review |
| Category Jump | > 80% GMV in one category + high-value outlier in another | Review |
| Single-Pattern Combo | < 30 days + single payment mode + single category + 0% coupons | Auto-reject |
| Electronics Concentration | > 80% GMV in Electronics with < 10 total transactions | Monitor |
| Dormant Account | Account > 90 days old with 0 total transactions | Review |

If any flag triggers `auto-reject`, the scoring engine is skipped entirely — the user gets a fraud-rejected tier with score 0.

### Score → Decision Mapping

| Score | Tier | Credit Limit | Rate | EMI Tenures |
|-------|------|-------------|------|-------------|
| 800–1000 | Pre-Approved | ₹50K–₹1L (interpolated) | 0% + ₹299 flat fee | 3, 6, 9, 12 months |
| 600–799 | Approved | ₹15K–₹50K (interpolated) | 14% APR | 3, 6, 9 months |
| 400–599 | Conditional | ₹5K–₹15K (interpolated) | 20% APR | 3, 6 months |
| < 400 | Rejected | — | — | — |
| Fraud-flagged | Fraud-Rejected | — | — | — |

Credit limits are linearly interpolated within each tier band — a score of 700 gets a higher limit than 620.

---

## The 5 Personas

Each persona is a carefully designed behavioral archetype that tells a story during the demo:

| # | Name | Archetype | Score | Tier | What They Demonstrate |
|---|------|-----------|-------|------|----------------------|
| 1 | **Priya Sharma** | Power User | 927 | Pre-Approved | 200+ transactions across 5 categories, 18-month history, growing GMV, 1.8% returns. The dream customer — pre-approved with ₹92K limit and 0% EMI. |
| 2 | **Rahul Verma** | Steady Spender | 672 | Approved | 80 transactions, mostly Food + Fashion, flat but consistent GMV, 5% returns. Solid but not exceptional — approved at 14% APR with ₹25K limit. |
| 3 | **Ananya Iyer** | New But Promising | 489 | Conditional | 25 transactions in 3 months, strong upward trajectory but single category (Travel), 0% returns. Great potential, limited history — conditional at 20% APR with ₹8K limit. Shows the "almost there" messaging. |
| 4 | **Vikram Singh** | Declining User | 312 | Rejected | 60 transactions but GMV declining 40% over 6 months, rising returns (11%), narrowing categories. The empathetic rejection — "we see you're pulling back, and we respect that." Shows the improvement path UI. |
| 5 | **Ghost User** | Suspicious New | 0 | Fraud-Rejected | 3 days old, 2 high-value electronics transactions, COD only, zero coupons. Triggers 3 fraud flags simultaneously. Shows the security-conscious rejection without revealing detection logic. |

---

## How to Run Locally

### Prerequisites
- **Node.js** ≥ 18
- **Anthropic API key** — for Claude-powered narratives ([get one here](https://console.anthropic.com/settings/keys))

### Quick start (one command)

```bash
git clone https://github.com/aayushnamdev/grabcredit-bnpl.git
cd grabcredit-bnpl

# Set your API key
cp .env.example web-app/.env.local
# Edit web-app/.env.local and add your ANTHROPIC_API_KEY

# Install, build, and launch
./scripts/demo.sh
```

Open [http://localhost:3000](http://localhost:3000). Switch personas at the top of the page.

### Manual setup (step-by-step)

```bash
# Step 1: Build the MCP server
cd mcp-server
npm install
npm run build       # compiles TypeScript → dist/, copies src/data/*.json → dist/data/

# Step 2: Configure env vars
cd ../web-app
cp ../.env.example .env.local
# Edit .env.local — paste your ANTHROPIC_API_KEY

# Step 3: Start the web app
npm install
npm run dev
```

### Step 4 (Optional): Connect MCP to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "grabcredit": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop. You can now ask Claude: *"What's Priya Sharma's credit profile?"* and it will call the MCP tools directly.

### Step 5 (Optional): Test MCP server standalone

```bash
cd mcp-server
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node dist/index.js
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes (for narratives) | — | Claude API key for generating credit narratives |
| `PAYU_MODE` | No | `mock` | `mock` for simulated PayU responses, `live` for sandbox API |
| `PAYU_KEY` | Only if live | — | PayU sandbox merchant key |
| `PAYU_SALT` | Only if live | — | PayU sandbox merchant salt |

---

## What the AI Can Do (MCP Tools)

The server follows the MCP specification with stdio transport and newline-delimited JSON (NDJSON) framing.

**8 Tools:**

| Tool | Input | Description |
|------|-------|-------------|
| `get_user_profile` | `user_id` | Returns full aggregated user profile |
| `get_transaction_history` | `user_id`, `months?` | Returns raw transactions (default 12 months) |
| `get_credit_score` | `user_id` | Full scoring with all 5 factors, fraud flags, tier, and limit |
| `get_emi_options` | `user_id`, `purchase_amount` | Original EMI calculator (18/24/30% by tier) |
| `get_payu_emi_options` | `user_id`, `purchase_amount`, `merchant_name?` | PayU LazyPay EMI options (0%+₹299 / 14% / 20%) |
| `confirm_emi_plan` | `user_id`, `purchase_amount`, `selected_months`, `merchant_name?` | Creates EMI plan via PayU (mock/live), returns schedule |
| `check_fraud_velocity` | `user_id` | Returns fraud flags with action severity |
| `generate_credit_narrative` | `user_id` | Calls Claude API to generate personalized narrative |

**2 Resources:**

| Resource | URI | Description |
|----------|-----|-------------|
| Transaction Schema | `transaction://schema` | JSON Schema for the transaction data model |
| Merchant Catalog | `merchant://catalog` | All merchants grouped by category |

---

## Why We Built It This Way

### Why TypeScript for everything?

The MCP SDK is TypeScript-first. The scoring engine lives inside the MCP server. The web app is Next.js (TypeScript). One language across the entire stack means no serialization boundaries, shared type definitions, and a single developer's mental model. The web app imports MCP tool functions directly — no socket communication overhead.

### Why these specific scoring weights?

Purchase Consistency gets the highest weight (25%) because in behavioral economics, frequency and regularity of spending is the strongest predictor of financial stability — more so than total amount. Account Maturity gets the lowest (15%) because it's partially redundant with Consistency — a mature account with no consistency is worthless.

### Why mock PayU as default instead of requiring sandbox credentials?

The demo must work on first clone. Requiring PayU sandbox credentials would gate the entire checkout flow behind environment setup. The mock client generates structurally identical responses (transaction IDs, EMI schedules, timestamps) — the only difference is the `mode: "mock"` flag. The live client is there for when real integration is needed.

### Why Next.js API routes instead of a separate Express server?

The web app needs server-side code to call MCP tools (they load JSON files from disk). Next.js API routes give us server-side execution without a separate process. The `eval('require')` pattern prevents Turbopack from trying to bundle the MCP server code.

### Why Claude Sonnet 4 for narratives, not a template engine?

Templates would be faster but they'd feel generic. The prompt feeds Claude the raw scoring factors, platform averages, and specific user data — Claude then generates narratives that cite exact numbers, compare against benchmarks, and adapt tone by tier. A pre-approved user gets celebratory language; a rejected user gets empathetic, actionable advice. No template can do that without becoming a sprawling if/else tree.

---

## What I'd Build With More Time

1. **Cohort-based scoring**: Cluster users by behavior similarity (k-means on the 5 factor scores), then use cohort default rates to calibrate individual scores. A user who looks like other users who defaulted should get a stricter assessment, regardless of their individual metrics.

2. **Real CIBIL integration as a validation layer**: Use the behavioral score as a fast pre-screen, then pull CIBIL for final underwriting on approved users. Compare behavioral vs. bureau scores over time to calibrate the model.

3. **Merchant-side analytics dashboard**: Show merchants their BNPL conversion rates segmented by user tier. "12% of your checkout users are pre-approved but only 4% chose EMI — here's how to surface the offer earlier."

4. **Temporal risk scoring**: Weight recent transactions more heavily using exponential decay. A user who was great for 11 months but had a terrible last month should score differently than a consistently mediocre user — the model currently doesn't capture this nuance beyond the decline modifier.

5. **A/B testing framework for EMI presentation**: Test whether showing total cost vs. monthly amount first affects conversion. Test whether showing the AI narrative upfront vs. behind a "Why?" click matters. The current UI makes assumptions about information hierarchy that should be validated.

6. **Real-time fraud velocity on transaction stream**: The current fraud check runs at scoring time on historical data. In production, you'd want a streaming check that flags suspicious patterns as transactions happen, not after the fact.

---

## Loom Walkthrough

<!-- Add your Loom link here before submitting -->

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| MCP Server | TypeScript + `@modelcontextprotocol/sdk` | MCP SDK is TS-first; spec compliance matters |
| Scoring Engine | TypeScript (same codebase) | No context-switching; scoring lives inside MCP |
| Narrative Engine | Claude Sonnet 4 via `@anthropic-ai/sdk` | Real AI-generated text, not templates |
| Web App | Next.js 16 + React 19 + Tailwind CSS 4 | Fast to build, server-side API routes, responsive |
| Charts | Recharts | React-native charting, clean radar/bar/line charts |
| Animations | Framer Motion | Smooth persona transitions and micro-interactions |
| PayU Integration | Mock client + Live client (sandbox REST) | Works offline by default, real integration available |
| Data Store | JSON files | No DB setup — this is a prototype. Data lives in `mcp-server/src/data/` |

---

## Data Structure

All mock data lives in `mcp-server/src/data/`. The TypeScript interfaces are the canonical schema definition (`mcp-server/src/types.ts`).

### Transaction

One record per purchase event.

| Field | Type | Valid Values / Range | Description |
|-------|------|---------------------|-------------|
| `transaction_id` | `string` | `"txn_00001"` … | Unique transaction identifier |
| `user_id` | `string` | `"user_001"` … `"user_005"` | Links to User record |
| `merchant_name` | `string` | e.g. `"Myntra"`, `"Zomato"` | Merchant display name |
| `merchant_category` | `string` | `"Fashion"` \| `"Travel"` \| `"Food"` \| `"Electronics"` \| `"Health"` | One of 5 categories |
| `subcategory` | `string` | e.g. `"Hotel Booking"`, `"Casual Wear"` | More specific product type |
| `transaction_amount` | `number` | `200` … `80,000` (INR) | Gross transaction value in ₹ |
| `coupon_used` | `boolean` | `true` \| `false` | Whether a GrabOn coupon was applied |
| `coupon_discount_percent` | `number` | `0` … `40` | Discount applied (0 if no coupon) |
| `payment_mode` | `string` | `"Credit Card"` \| `"UPI"` \| `"Debit Card"` \| `"NetBanking"` \| `"COD"` | Payment method used |
| `return_flag` | `boolean` | `true` \| `false` | Whether the item was returned |
| `refund_amount` | `number` | `0` … `transaction_amount` (INR) | Refund issued (0 if not returned) |
| `timestamp` | `string` | ISO 8601 with IST offset | Transaction datetime |
| `device_type` | `string` | `"mobile"` \| `"desktop"` \| `"tablet"` | Device used at purchase |

**Example:**
```json
{
  "transaction_id": "txn_00001",
  "user_id": "user_001",
  "merchant_name": "EaseMyTrip",
  "merchant_category": "Travel",
  "subcategory": "Hotel Booking",
  "transaction_amount": 1035,
  "coupon_used": true,
  "coupon_discount_percent": 21,
  "payment_mode": "UPI",
  "return_flag": false,
  "refund_amount": 0,
  "timestamp": "2024-08-08T16:49:32+05:30",
  "device_type": "mobile"
}
```

### User Profile

One record per user — pre-aggregated from transactions for scoring efficiency.

| Field | Type | Valid Values / Range | Description |
|-------|------|---------------------|-------------|
| `user_id` | `string` | `"user_001"` … `"user_005"` | Primary key |
| `name` | `string` | e.g. `"Priya Sharma"` | Display name |
| `registration_date` | `string` | ISO 8601 date | When the GrabOn account was created |
| `email` | `string` | valid email | Contact email |
| `phone` | `string` | `"+91-XXXXXXXXXX"` | Indian mobile number |
| `total_transactions` | `number` | `2` … `214` | Lifetime transaction count |
| `total_gmv` | `number` | INR | Lifetime gross merchandise value |
| `active_months` | `number` | `1` … `18` | Months with at least one transaction |
| `categories_shopped` | `string[]` | subset of 5 categories | Distinct categories ever purchased in |
| `avg_monthly_spend` | `number` | INR | Mean monthly GMV across active months |
| `deal_redemption_rate` | `number` | `0.0` … `1.0` | Fraction of transactions where a coupon was used |
| `return_rate` | `number` | `0.0` … `0.50` | Fraction of orders returned |
| `payment_mode_distribution` | `Record<string, number>` | values sum to 1.0 | Share of GMV by payment mode |
| `gmv_trend_12m` | `number[]` | 12 elements, INR | Monthly GMV for the last 12 months (oldest first; 0 = no activity that month) |
| `favorite_merchants` | `string[]` | top 3 by transaction count | Merchants with most repeat purchases |
| `last_transaction_date` | `string` | ISO 8601 date | Date of most recent transaction |

**Example:**
```json
{
  "user_id": "user_001",
  "name": "Priya Sharma",
  "registration_date": "2024-08-15",
  "total_transactions": 214,
  "total_gmv": 85200,
  "active_months": 18,
  "categories_shopped": ["Fashion", "Travel", "Food", "Electronics", "Health"],
  "avg_monthly_spend": 4733,
  "deal_redemption_rate": 0.55,
  "return_rate": 0.02,
  "payment_mode_distribution": { "Credit Card": 0.6, "UPI": 0.3, "Debit Card": 0.1 },
  "gmv_trend_12m": [3800, 4100, 4200, 4400, 4300, 4600, 4700, 4900, 5000, 5200, 5400, 5600],
  "favorite_merchants": ["Myntra", "MakeMyTrip", "Zomato"],
  "last_transaction_date": "2026-02-24"
}
```
