import { UserProfile, Transaction } from '../types';
import { calculateCreditScore, CURRENT_DATE } from '../scoring/engine';
import { computePlatformAverages } from '../narrative/platformAverages';
import { generateNarrative } from '../narrative/generator';

export const TOOL_DEFINITION = {
  name: 'generate_credit_narrative',
  description: 'Generate a personalized credit decision narrative for a user using AI. Returns a 150-300 word narrative explaining the credit decision with specific numbers, behavioral insights, and actionable next steps.',
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

export async function generateCreditNarrative(
  users: UserProfile[],
  transactions: Transaction[],
  args: { user_id: string }
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
  const platformAverages = computePlatformAverages(users, transactions);
  const narrative = await generateNarrative(profile, scoreResult, platformAverages);

  return {
    content: [{ type: 'text', text: narrative }],
  };
}
