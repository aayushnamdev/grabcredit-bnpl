import { Transaction } from '../types';
import { CURRENT_DATE } from '../scoring/engine';

export const TOOL_DEFINITION = {
  name: 'get_transaction_history',
  description: 'Retrieve transaction history for a user, optionally filtered to the last N months.',
  inputSchema: {
    type: 'object',
    properties: {
      user_id: {
        type: 'string',
        description: 'The unique user identifier',
      },
      months: {
        type: 'number',
        description: 'Number of months to look back (default: 12)',
      },
    },
    required: ['user_id'],
  },
};

export function getTransactionHistory(
  transactions: Transaction[],
  args: { user_id: string; months?: number }
): { content: Array<{ type: string; text: string }>; isError?: boolean } {
  const months = args.months ?? 12;
  const cutoff = new Date(CURRENT_DATE);
  cutoff.setMonth(cutoff.getMonth() - months);

  const userTxns = transactions.filter(
    t => t.user_id === args.user_id && new Date(t.timestamp) >= cutoff
  );

  if (userTxns.length === 0) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          user_id: args.user_id,
          months_requested: months,
          transactions: [],
          summary: { total_count: 0, total_amount: 0, date_range: null },
        }, null, 2),
      }],
    };
  }

  const sorted = [...userTxns].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const totalAmount = userTxns.reduce((sum, t) => sum + t.transaction_amount, 0);

  const result = {
    user_id: args.user_id,
    months_requested: months,
    transactions: sorted,
    summary: {
      total_count: userTxns.length,
      total_amount: totalAmount,
      date_range: {
        from: sorted[0].timestamp,
        to: sorted[sorted.length - 1].timestamp,
      },
    },
  };

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
}
