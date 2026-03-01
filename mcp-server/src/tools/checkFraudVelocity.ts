import { UserProfile, Transaction } from '../types';
import { checkFraudFlags } from '../scoring/fraudDetection';
import { CURRENT_DATE } from '../scoring/engine';

export const TOOL_DEFINITION = {
  name: 'check_fraud_velocity',
  description: 'Run fraud velocity checks for a user and return flagging status, recommended action, and reasons.',
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

export function checkFraudVelocity(
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
  const fraudResult = checkFraudFlags(profile, userTxns, CURRENT_DATE);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        flagged: fraudResult.flagged,
        action: fraudResult.action,
        reasons: fraudResult.flags,
      }, null, 2),
    }],
  };
}
