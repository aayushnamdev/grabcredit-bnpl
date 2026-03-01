export interface UserProfile {
  user_id: string;
  name: string;
  registration_date: string;
  email: string;
  phone: string;
  total_transactions: number;
  total_gmv: number;
  active_months: number;
  categories_shopped: string[];
  avg_monthly_spend: number;
  deal_redemption_rate: number;
  return_rate: number;
  payment_mode_distribution: Record<string, number>;
  gmv_trend_12m: number[];
  favorite_merchants: string[];
  last_transaction_date: string;
}

export interface Transaction {
  transaction_id: string;
  user_id: string;
  merchant_name: string;
  merchant_category: string;
  subcategory: string;
  transaction_amount: number;
  coupon_used: boolean;
  coupon_discount_percent: number;
  payment_mode: string;
  return_flag: boolean;
  refund_amount: number;
  timestamp: string;
  device_type: string;
}

export interface FactorResult {
  score: number;       // 0-100
  weight: number;      // factor weight
  reasons: string[];   // human-readable explanations
}

export interface FraudResult {
  flagged: boolean;
  flags: string[];
  action: 'none' | 'review' | 'auto-reject';
}

export interface ScoreResult {
  score: number;           // 0-1000
  tier: 'pre-approved' | 'approved' | 'conditional' | 'rejected' | 'fraud-rejected';
  creditLimit: number;
  rateTier: number;        // 1, 2, 3, or 0
  dataConfidence: number;  // 0.0–1.0: confidence in score reliability based on data density
  factors: {
    purchaseConsistency: FactorResult;
    dealEngagement: FactorResult;
    financialTrajectory: FactorResult;
    riskSignals: FactorResult;
    accountMaturity: FactorResult;
  };
  fraudFlags: FraudResult;
}
