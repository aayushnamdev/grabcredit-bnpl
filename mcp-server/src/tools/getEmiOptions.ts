import { UserProfile, Transaction } from '../types';
import { calculateCreditScore, CURRENT_DATE } from '../scoring/engine';

export const TOOL_DEFINITION = {
  name: 'get_emi_options',
  description: 'Calculate EMI payment plans for a purchase amount based on the user\'s credit tier.',
  inputSchema: {
    type: 'object',
    properties: {
      user_id: {
        type: 'string',
        description: 'The unique user identifier',
      },
      purchase_amount: {
        type: 'number',
        description: 'The purchase amount in INR',
      },
    },
    required: ['user_id', 'purchase_amount'],
  },
};

const RATE_CONFIG: Record<number, { annualRate: number; monthlyRate: number }> = {
  1: { annualRate: 18, monthlyRate: 1.5 / 100 },
  2: { annualRate: 24, monthlyRate: 2.0 / 100 },
  3: { annualRate: 30, monthlyRate: 2.5 / 100 },
};

const TENORS = [3, 6, 9];

function calcEmi(principal: number, monthlyRate: number, months: number): number {
  const r = monthlyRate;
  const n = months;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function getEmiOptions(
  users: UserProfile[],
  transactions: Transaction[],
  args: { user_id: string; purchase_amount: number }
): { content: Array<{ type: string; text: string }>; isError?: boolean } {
  const profile = users.find(u => u.user_id === args.user_id);
  if (!profile) {
    return {
      content: [{ type: 'text', text: `User not found: ${args.user_id}` }],
      isError: true,
    };
  }

  const userTxns = transactions.filter(t => t.user_id === args.user_id);
  const scoreResult = calculateCreditScore(profile, userTxns, CURRENT_DATE);
  const { rateTier, tier } = scoreResult;

  if (rateTier === 0) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          eligible: false,
          rateTier: 0,
          reason: tier === 'fraud-rejected'
            ? 'Account flagged for fraud — BNPL not available'
            : 'Credit score too low — not eligible for BNPL',
        }, null, 2),
      }],
    };
  }

  const config = RATE_CONFIG[rateTier];
  const P = args.purchase_amount;

  const plans = TENORS.map(n => {
    const emi = calcEmi(P, config.monthlyRate, n);
    const totalPayable = emi * n;
    const totalInterest = totalPayable - P;
    return {
      months: n,
      emi: Math.round(emi),
      totalPayable: Math.round(totalPayable),
      totalInterest: Math.round(totalInterest),
    };
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        eligible: true,
        rateTier,
        annualRate: config.annualRate,
        plans,
      }, null, 2),
    }],
  };
}
