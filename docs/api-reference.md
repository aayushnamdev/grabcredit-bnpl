# API Reference

GrabCredit exposes two surfaces:
1. **REST API** — Next.js API routes consumed by the web frontend
2. **MCP Server** — Model Context Protocol server usable from Claude Desktop or any MCP client

---

## REST API (Next.js)

Base URL: `http://localhost:3000/api`

All routes are server-side only and call the MCP server functions directly (no socket overhead).

---

### GET `/api/profile?user_id=<id>`

Returns the aggregated user profile.

**Example:**
```bash
curl "http://localhost:3000/api/profile?user_id=user_001"
```

**Response:**
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
  "return_rate": 0.018,
  "payment_mode_distribution": { "Credit Card": 0.6, "UPI": 0.3, "Debit Card": 0.1 },
  "gmv_trend_12m": [3800, 4100, 4200, 4400, 4300, 4600, 4700, 4900, 5000, 5200, 5400, 5600],
  "favorite_merchants": ["Myntra", "MakeMyTrip", "Zomato"],
  "last_transaction_date": "2026-02-24"
}
```

---

### GET `/api/score?user_id=<id>`

Runs the full scoring pipeline and returns tier, credit limit, factor breakdown, and fraud flags.

**Example:**
```bash
curl "http://localhost:3000/api/score?user_id=user_001"
```

**Response:**
```json
{
  "score": 927,
  "tier": "pre-approved",
  "creditLimit": 92700,
  "rateTier": 1,
  "dataConfidence": 1.0,
  "factors": {
    "purchaseConsistency": { "score": 95, "weight": 0.25, "reasons": ["Active 18/18 months", "CV: 0.12 — very stable spend", "Last transaction: 2 days ago"] },
    "dealEngagement":      { "score": 88, "weight": 0.20, "reasons": ["Redemption rate: 55% — optimal range", "5 categories — maximum diversification"] },
    "financialTrajectory": { "score": 92, "weight": 0.20, "reasons": ["12-month trend: +₹1800/month slope", "Normalized slope: +0.046 — strong growth"] },
    "riskSignals":         { "score": 94, "weight": 0.20, "reasons": ["Return rate: 1.8% vs Fashion avg 8%", "60% Credit Card payments — lowest risk mode"] },
    "accountMaturity":     { "score": 100, "weight": 0.15, "reasons": ["214 transactions (bracket: 100)", "18 active months"] }
  },
  "fraudFlags": { "flagged": false, "flags": [], "action": "none" }
}
```

---

### GET `/api/emi-options?user_id=<id>&amount=<amount>`

Returns PayU LazyPay EMI plans for the given purchase amount.

**Example:**
```bash
curl "http://localhost:3000/api/emi-options?user_id=user_001&amount=15000"
```

**Response:**
```json
{
  "eligible": true,
  "rateTier": 1,
  "tier": "pre-approved",
  "credit_limit": 92700,
  "purchase_amount": 15000,
  "mode": "mock",
  "options": [
    { "months": 3,  "monthly_emi": 5099, "total_interest": 0,   "processing_fee": 299, "total_payable": 15299, "effective_annual_rate": 0 },
    { "months": 6,  "monthly_emi": 2549, "total_interest": 0,   "processing_fee": 299, "total_payable": 15299, "effective_annual_rate": 0 },
    { "months": 9,  "monthly_emi": 1699, "total_interest": 0,   "processing_fee": 299, "total_payable": 15299, "effective_annual_rate": 0 },
    { "months": 12, "monthly_emi": 1274, "total_interest": 0,   "processing_fee": 299, "total_payable": 15299, "effective_annual_rate": 0 }
  ]
}
```

---

### POST `/api/confirm-emi`

Creates an EMI plan and returns the payment schedule.

**Example:**
```bash
curl -X POST "http://localhost:3000/api/confirm-emi" \
  -H "Content-Type: application/json" \
  -d '{ "user_id": "user_001", "purchase_amount": 15000, "selected_months": 3 }'
```

**Response:**
```json
{
  "status": "success",
  "txnid": "GC-1740000000000-U001",
  "mihpayid": "PAY-1740000000000-MOCK",
  "emi_plan_id": "EMI-1740000000000-U001-3M",
  "emi_tenure": 3,
  "monthly_emi": 5099.67,
  "emi_start_date": "2026-03-28",
  "total_amount": 15000,
  "processing_fee": 299,
  "total_cost": 15299,
  "mode": "mock",
  "timestamp": "2026-02-28T10:00:00.000Z",
  "schedule": [
    { "installment": 1, "due_date": "2026-03-28", "amount": 5099.67, "principal": 5099.67, "interest": 0 },
    { "installment": 2, "due_date": "2026-04-28", "amount": 5099.67, "principal": 5099.67, "interest": 0 },
    { "installment": 3, "due_date": "2026-05-28", "amount": 5099.66, "principal": 5099.66, "interest": 0 }
  ]
}
```

---

### GET `/api/narrative?user_id=<id>`

Calls Claude Sonnet 4 to generate a personalized credit narrative. Requires `ANTHROPIC_API_KEY`.

**Example:**
```bash
curl "http://localhost:3000/api/narrative?user_id=user_001"
```

**Response:**
```json
{
  "narrative": "Priya, your GrabCredit pre-approval reflects 18 months of exceptional platform engagement. Your purchase consistency score of 95/100 — built on activity across all 5 categories with a remarkably stable monthly spend of ₹4,733 — places you well above the platform average of ₹2,100. Your 55% deal redemption rate sits in the optimal range, signaling financially intentional behavior rather than impulsive purchasing. With a return rate of just 1.8% compared to the platform average of 6.2%, you demonstrate decisive purchase confidence..."
}
```

---

### GET `/api/platform-averages`

Returns platform-wide aggregate statistics (used to contextualize individual scores in narratives).

**Example:**
```bash
curl "http://localhost:3000/api/platform-averages"
```

---

## MCP Server

The MCP server runs on stdio transport with NDJSON framing. Connect it to Claude Desktop for conversational credit analysis, or test it directly:

```bash
# Initialize handshake
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}' \
  | node mcp-server/dist/index.js

# List available tools
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' \
  | node mcp-server/dist/index.js
```

### Tools

| Tool | Input | Output |
|------|-------|--------|
| `get_user_profile` | `{ user_id: string }` | Full `UserProfile` object |
| `get_transaction_history` | `{ user_id: string, months?: number }` | Array of `Transaction` records |
| `get_credit_score` | `{ user_id: string }` | Full `ScoreResult` with factors, fraud flags, tier |
| `get_emi_options` | `{ user_id: string, purchase_amount: number }` | `PayUEmiOptionsResult` |
| `get_payu_emi_options` | `{ user_id: string, purchase_amount: number, merchant_name?: string }` | `PayUEmiOptionsResult` (PayU LazyPay rates) |
| `confirm_emi_plan` | `{ user_id: string, purchase_amount: number, selected_months: number, merchant_name?: string }` | `PayUEmiCreateResponse` with payment schedule |
| `check_fraud_velocity` | `{ user_id: string }` | `{ flagged, action, reasons }` |
| `generate_credit_narrative` | `{ user_id: string }` | Plain text narrative (string) |

### Resources

| URI | Description |
|-----|-------------|
| `transaction://schema` | JSON Schema for the Transaction data model |
| `merchant://catalog` | All merchants grouped by category |

### Persona → User ID Mapping

| Persona label | user_id | Tier |
|--------------|---------|------|
| p1 / Priya Sharma | `user_001` | Pre-Approved |
| p2 / Rahul Verma | `user_002` | Approved |
| p3 / Ananya Iyer | `user_003` | Conditional |
| p4 / Vikram Singh | `user_004` | Rejected |
| p5 / Ghost User | `user_005` | Fraud-Rejected |
