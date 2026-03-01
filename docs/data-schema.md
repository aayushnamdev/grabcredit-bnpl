# Data Schema

All mock data lives in `mcp-server/src/data/`. The TypeScript interfaces are the canonical schema definition (`mcp-server/src/types.ts`).

## Transaction

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

## User Profile

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
