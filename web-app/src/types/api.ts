// Frontend interfaces mirroring backend types

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

export interface FactorResult {
  score: number;
  weight: number;
  reasons: string[];
}

export interface FraudResult {
  flagged: boolean;
  flags: string[];
  action: 'none' | 'review' | 'auto-reject';
}

export interface ScoreResult {
  score: number;
  tier: 'pre-approved' | 'approved' | 'conditional' | 'rejected' | 'fraud-rejected';
  creditLimit: number;
  rateTier: number;
  dataConfidence: number;  // 0.0–1.0: reliability of score based on data density
  factors: {
    purchaseConsistency: FactorResult;
    dealEngagement: FactorResult;
    financialTrajectory: FactorResult;
    riskSignals: FactorResult;
    accountMaturity: FactorResult;
  };
  fraudFlags: FraudResult;
}

export interface EmiOption {
  months: number;
  monthly_emi: number;
  total_interest: number;
  processing_fee: number;
  total_payable: number;
  effective_annual_rate: number;
}

export interface PayUEmiOptionsResult {
  eligible: boolean;
  rateTier: number;
  tier: string;
  credit_limit: number;
  purchase_amount: number;
  options: EmiOption[];
  mode: 'mock' | 'live';
}

export interface EmiInstallment {
  installment: number;
  due_date: string;
  amount: number;
  principal: number;
  interest: number;
}

export interface PayUEmiCreateResponse {
  status: 'success' | 'failure';
  txnid: string;
  mihpayid: string;
  emi_plan_id: string;
  emi_tenure: number;
  monthly_emi: number;
  emi_start_date: string;
  schedule: EmiInstallment[];
  total_amount: number;
  processing_fee: number;
  total_cost: number;
  mode: 'mock' | 'live';
  timestamp: string;
  error_code?: string;
  error_message?: string;
}

export interface PlatformAverages {
  avgMonthlySpend: number;
  avgDealRedemptionRate: number;
  avgReturnRate: number;
  avgTotalTransactions: number;
  avgCategoriesCount: number;
  avgFactorScores: {
    purchaseConsistency: number;
    dealEngagement: number;
    financialTrajectory: number;
    riskSignals: number;
    accountMaturity: number;
  };
  userCount: number;
}

// Persona mapping: frontend ID → backend user_id
export const PERSONA_MAP: Record<string, string> = {
  p1: 'user_001',
  p2: 'user_002',
  p3: 'user_003',
  p4: 'user_004',
  p5: 'user_005',
};

export const PERSONA_IDS = ['p1', 'p2', 'p3', 'p4', 'p5'] as const;
export type PersonaId = (typeof PERSONA_IDS)[number];
