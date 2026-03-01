// --- PayU wire shapes ---

export interface PayUEmiCreateRequest {
  key: string;           // merchant key
  txnid: string;         // unique transaction ID (caller-generated)
  amount: number;        // purchase amount in INR
  productinfo: string;   // merchant/product label
  firstname: string;
  email: string;
  phone: string;
  emi_tenure: number;    // selected months
  payment_type: 'LAZYPAY_EMI';
  hash?: string;         // sha512 hash (live mode only)
}

export interface EmiInstallment {
  installment: number;   // 1-indexed
  due_date: string;      // ISO date YYYY-MM-DD
  amount: number;        // total due this month (principal + interest)
  principal: number;     // principal component
  interest: number;      // interest component
}

export interface PayUEmiCreateResponse {
  status: 'success' | 'failure';
  txnid: string;         // our txnid echoed back
  mihpayid: string;      // PayU internal ID (e.g. "MIHU403259283752")
  emi_plan_id: string;   // e.g. "EMIPLAN_20260226_A3F9"
  emi_tenure: number;
  monthly_emi: number;   // rounded rupees
  emi_start_date: string;
  schedule: EmiInstallment[];
  total_amount: number;  // sum of schedule amounts = principal + interest
  processing_fee: number;
  total_cost: number;    // total_amount + processing_fee
  mode: 'mock' | 'live';
  timestamp: string;     // ISO-8601
  error_code?: string;
  error_message?: string;
}

// --- Internal option shapes (for get_payu_emi_options) ---

export interface EmiOption {
  months: number;
  monthly_emi: number;     // rounded INR
  total_interest: number;  // rounded INR
  processing_fee: number;  // 299 for tier 1, 0 otherwise
  total_payable: number;   // principal + interest + processing_fee
  effective_annual_rate: number;  // 0 for tier 1, 14 for tier 2, 20 for tier 3
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

export interface PayUClient {
  createEmiPlan(req: PayUEmiCreateRequest): Promise<PayUEmiCreateResponse>;
}
