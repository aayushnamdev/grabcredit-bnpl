import { UserProfile, Transaction } from '../types';
import { calculateCreditScore, CURRENT_DATE } from '../scoring/engine';
import { EMI_CONFIG } from '../payu/emiCalculator';
import { createPayUClient, getPayUMode } from '../payu/client';
import { PayUEmiCreateRequest } from '../payu/types';

export const TOOL_DEFINITION = {
  name: 'confirm_emi_plan',
  description: 'Confirm an EMI plan via PayU LazyPay for a specific tenure. Returns a full payment schedule with due dates, principal and interest breakdown per installment.',
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
      selected_months: {
        type: 'number',
        description: 'Number of EMI months (must be valid for the user\'s credit tier)',
      },
      merchant_name: {
        type: 'string',
        description: 'Optional merchant or product name',
      },
    },
    required: ['user_id', 'purchase_amount', 'selected_months'],
  },
};

export async function confirmEmiPlan(
  users: UserProfile[],
  transactions: Transaction[],
  args: { user_id: string; purchase_amount: number; selected_months: number; merchant_name?: string }
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
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

  // Eligibility check
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
          reason: `Purchase amount ₹${args.purchase_amount} exceeds credit limit of ₹${creditLimit.toLocaleString('en-IN')}`,
        }, null, 2),
      }],
      isError: true,
    };
  }

  // Validate selected_months for this tier
  const config = EMI_CONFIG[rateTier];
  if (!config.tenors.includes(args.selected_months)) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: `Invalid tenure: ${args.selected_months} months is not available for your credit tier (${tier}). Valid options: ${config.tenors.join(', ')} months.`,
        }, null, 2),
      }],
      isError: true,
    };
  }

  const txnid = `GC_${args.user_id}_${Date.now()}`;
  const productinfo = args.merchant_name ?? 'GrabOn Purchase';

  const req: PayUEmiCreateRequest & { _monthlyRate: number; _processingFee: number } = {
    key: process.env.PAYU_KEY ?? 'test_key',
    txnid,
    amount: args.purchase_amount,
    productinfo,
    firstname: profile.name.split(' ')[0],
    email: profile.email,
    phone: profile.phone,
    emi_tenure: args.selected_months,
    payment_type: 'LAZYPAY_EMI',
    // Internal fields consumed by MockPayUClient
    _monthlyRate: config.monthlyRate,
    _processingFee: config.processingFee,
  };

  const client = createPayUClient();
  const response = await client.createEmiPlan(req);

  return {
    content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
    isError: response.status === 'failure',
  };
}
