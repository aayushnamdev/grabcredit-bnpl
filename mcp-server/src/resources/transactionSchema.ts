export const RESOURCE_DEFINITION = {
  uri: 'transaction://schema',
  name: 'Transaction Schema',
  description: 'JSON Schema describing the Transaction interface used in GrabCredit scoring.',
  mimeType: 'application/json',
};

const SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Transaction',
  description: 'A single GrabOn platform transaction used in BNPL credit scoring.',
  type: 'object',
  required: [
    'transaction_id', 'user_id', 'merchant_name', 'merchant_category',
    'subcategory', 'transaction_amount', 'coupon_used', 'coupon_discount_percent',
    'payment_mode', 'return_flag', 'refund_amount', 'timestamp', 'device_type',
  ],
  properties: {
    transaction_id: {
      type: 'string',
      description: 'Unique transaction identifier',
      examples: ['txn_00001'],
    },
    user_id: {
      type: 'string',
      description: 'Reference to the user who made this transaction',
      examples: ['user_001'],
    },
    merchant_name: {
      type: 'string',
      description: 'Name of the merchant',
      examples: ['Myntra', 'MakeMyTrip', 'Blinkit'],
    },
    merchant_category: {
      type: 'string',
      description: 'Top-level merchant category',
      examples: ['Fashion', 'Travel', 'Grocery', 'Electronics', 'Food'],
    },
    subcategory: {
      type: 'string',
      description: 'Sub-category within the merchant category',
      examples: ['Apparel', 'Hotel Booking', 'Grocery Delivery'],
    },
    transaction_amount: {
      type: 'number',
      description: 'Transaction value in INR (before coupon discount)',
      examples: [1035, 4500, 12000],
    },
    coupon_used: {
      type: 'boolean',
      description: 'Whether a GrabOn coupon was used for this transaction',
    },
    coupon_discount_percent: {
      type: 'number',
      description: 'Discount percentage applied via coupon (0 if no coupon)',
      minimum: 0,
      maximum: 100,
      examples: [0, 10, 21],
    },
    payment_mode: {
      type: 'string',
      description: 'Payment method used',
      enum: ['UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Wallet'],
    },
    return_flag: {
      type: 'boolean',
      description: 'Whether this transaction was returned/refunded',
    },
    refund_amount: {
      type: 'number',
      description: 'Refund amount in INR (0 if no refund)',
      minimum: 0,
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
      description: 'ISO 8601 timestamp of the transaction',
      examples: ['2024-08-08T16:49:32+05:30'],
    },
    device_type: {
      type: 'string',
      description: 'Device type used for the transaction',
      enum: ['mobile', 'desktop', 'tablet'],
    },
  },
};

export function readTransactionSchema(): {
  contents: Array<{ uri: string; mimeType: string; text: string }>;
} {
  return {
    contents: [{
      uri: RESOURCE_DEFINITION.uri,
      mimeType: RESOURCE_DEFINITION.mimeType,
      text: JSON.stringify(SCHEMA, null, 2),
    }],
  };
}
