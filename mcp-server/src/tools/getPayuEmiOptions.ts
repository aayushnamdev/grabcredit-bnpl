import { UserProfile, Transaction } from '../types';
import { calculateCreditScore, CURRENT_DATE } from '../scoring/engine';
import { computeEmiOptions } from '../payu/emiCalculator';
import { getPayUMode } from '../payu/client';
import { PayUEmiOptionsResult } from '../payu/types';

export const TOOL_DEFINITION = {
  name: 'get_payu_emi_options',
  description: 'Get PayU LazyPay EMI options with full cost breakdown for a purchase. Returns eligible tenors, monthly EMI, interest, and total payable based on the user\'s credit tier.',
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
      merchant_name: {
        type: 'string',
        description: 'Optional merchant name for context',
      },
    },
    required: ['user_id', 'purchase_amount'],
  },
};

export function getPayuEmiOptions(
  users: UserProfile[],
  transactions: Transaction[],
  args: { user_id: string; purchase_amount: number; merchant_name?: string }
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
  const { rateTier, tier, creditLimit } = scoreResult;

  if (rateTier === 0) {
    const reason = tier === 'fraud-rejected'
      ? 'Account flagged for fraud — BNPL not available'
      : 'Credit score too low — not eligible for BNPL';
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ eligible: false, rateTier: 0, reason }, null, 2),
      }],
    };
  }

  if (args.purchase_amount > creditLimit) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          eligible: false,
          rateTier,
          reason: `Purchase amount exceeds credit limit of ₹${creditLimit.toLocaleString('en-IN')}`,
        }, null, 2),
      }],
    };
  }

  const options = computeEmiOptions(args.purchase_amount, rateTier);

  const result: PayUEmiOptionsResult = {
    eligible: true,
    rateTier,
    tier,
    credit_limit: creditLimit,
    purchase_amount: args.purchase_amount,
    options,
    mode: getPayUMode(),
  };

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
}
