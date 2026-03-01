import { UserProfile, Transaction } from '../types';
import { calculateCreditScore, CURRENT_DATE } from '../scoring/engine';

export const TOOL_DEFINITION = {
  name: 'get_credit_score',
  description: 'Calculate the GrabCredit BNPL score for a user. Returns score, tier, credit limit, rate tier, factor breakdown, and fraud flags.',
  inputSchema: {
    type: 'object',
    properties: {
      user_id: {
        type: 'string',
        description: 'The unique user identifier',
      },
    },
    required: ['user_id'],
  },
};

export function getCreditScore(
  users: UserProfile[],
  transactions: Transaction[],
  args: { user_id: string }
): { content: Array<{ type: string; text: string }>; isError?: boolean } {
  const profile = users.find(u => u.user_id === args.user_id);
  if (!profile) {
    return {
      content: [{ type: 'text', text: `User not found: ${args.user_id}` }],
      isError: true,
    };
  }

  const userTxns = transactions.filter(t => t.user_id === args.user_id);
  const result = calculateCreditScore(profile, userTxns, CURRENT_DATE);

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
}
