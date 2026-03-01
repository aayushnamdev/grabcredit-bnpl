import { EmiInstallment, EmiOption } from './types';

// Rate config for PayU LazyPay EMI plans, keyed by rateTier (1/2/3).
// Tier 1: 0% interest — cost recovered via flat ₹299 processing fee (pre-approved users only).
// Tier 2: 14% APR — reducing-balance; no processing fee.
// Tier 3: 20% APR — reducing-balance; no processing fee.
// Tenors are capped per tier: higher tiers get fewer options to limit repayment risk.
const EMI_CONFIG: Record<number, { annualRate: number; monthlyRate: number; processingFee: number; tenors: number[] }> = {
  1: { annualRate: 0,  monthlyRate: 0,           processingFee: 299, tenors: [3, 6, 9, 12] },
  2: { annualRate: 14, monthlyRate: 14 / 12 / 100, processingFee: 0,   tenors: [3, 6, 9]    },
  3: { annualRate: 20, monthlyRate: 20 / 12 / 100, processingFee: 0,   tenors: [3, 6]       },
};

// Standard reducing-balance EMI
function calcEmi(P: number, r: number, n: number): number {
  if (r === 0) return P / n;
  return (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

// Add months to a date, returning YYYY-MM-DD
function addMonths(date: Date, months: number): string {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

// Build per-installment schedule using reducing balance
export function buildSchedule(
  principal: number,
  monthlyRate: number,
  months: number,
  startDate: Date
): EmiInstallment[] {
  const emi = calcEmi(principal, monthlyRate, months);
  const schedule: EmiInstallment[] = [];
  let balance = principal;

  for (let i = 1; i <= months; i++) {
    const interest = Math.round(balance * monthlyRate);
    const principalComponent = i === months
      ? balance  // last installment: clear remaining balance
      : Math.round(emi - interest);
    const amount = principalComponent + interest;
    balance = Math.max(0, balance - principalComponent);

    schedule.push({
      installment: i,
      due_date: addMonths(startDate, i),
      amount,
      principal: principalComponent,
      interest,
    });
  }

  return schedule;
}

// Compute all EmiOptions for a given tier
export function computeEmiOptions(principal: number, rateTier: number): EmiOption[] {
  const config = EMI_CONFIG[rateTier];
  if (!config) return [];

  return config.tenors.map(months => {
    if (config.monthlyRate === 0) {
      const monthly_emi = Math.round(principal / months);
      return {
        months,
        monthly_emi,
        total_interest: 0,
        processing_fee: config.processingFee,
        total_payable: principal + config.processingFee,
        effective_annual_rate: 0,
      };
    }

    const emi = calcEmi(principal, config.monthlyRate, months);
    const monthly_emi = Math.round(emi);
    const total_payable_raw = emi * months;
    const total_interest = Math.round(total_payable_raw - principal);

    return {
      months,
      monthly_emi,
      total_interest,
      processing_fee: 0,
      total_payable: Math.round(total_payable_raw),
      effective_annual_rate: config.annualRate,
    };
  });
}

export { EMI_CONFIG };
