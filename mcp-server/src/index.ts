import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as path from 'path';

import { UserProfile, Transaction } from './types';
import { TOOL_DEFINITION as GET_USER_PROFILE_DEF, getUserProfile } from './tools/getUserProfile';
import { TOOL_DEFINITION as GET_TXN_HISTORY_DEF, getTransactionHistory } from './tools/getTransactionHistory';
import { TOOL_DEFINITION as GET_CREDIT_SCORE_DEF, getCreditScore } from './tools/getCreditScore';
import { TOOL_DEFINITION as GET_EMI_OPTIONS_DEF, getEmiOptions } from './tools/getEmiOptions';
import { TOOL_DEFINITION as CHECK_FRAUD_DEF, checkFraudVelocity } from './tools/checkFraudVelocity';
import { TOOL_DEFINITION as GEN_NARRATIVE_DEF, generateCreditNarrative } from './tools/generateNarrative';
import { TOOL_DEFINITION as GET_PAYU_EMI_DEF, getPayuEmiOptions } from './tools/getPayuEmiOptions';
import { TOOL_DEFINITION as CONFIRM_EMI_DEF, confirmEmiPlan } from './tools/confirmEmiPlan';
import { RESOURCE_DEFINITION as TXN_SCHEMA_DEF, readTransactionSchema } from './resources/transactionSchema';
import { RESOURCE_DEFINITION as MERCHANT_CATALOG_DEF, buildMerchantCatalog } from './resources/merchantCatalog';

// Load data once at startup
const usersPath = path.join(__dirname, 'data', 'users.json');
const txnsPath = path.join(__dirname, 'data', 'transactions.json');

const users: UserProfile[] = require(usersPath);
const transactions: Transaction[] = require(txnsPath);

// Pre-build merchant catalog at startup
const merchantCatalogResult = buildMerchantCatalog(transactions);

// Create server
const server = new Server(
  { name: 'grabcredit-mcp-server', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {} } }
);

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    GET_USER_PROFILE_DEF,
    GET_TXN_HISTORY_DEF,
    GET_CREDIT_SCORE_DEF,
    GET_EMI_OPTIONS_DEF,
    CHECK_FRAUD_DEF,
    GEN_NARRATIVE_DEF,
    GET_PAYU_EMI_DEF,
    CONFIRM_EMI_DEF,
  ],
}));

// Call tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'get_user_profile':
      return getUserProfile(users, args as { user_id: string });

    case 'get_transaction_history':
      return getTransactionHistory(transactions, args as { user_id: string; months?: number });

    case 'get_credit_score':
      return getCreditScore(users, transactions, args as { user_id: string });

    case 'get_emi_options':
      return getEmiOptions(users, transactions, args as { user_id: string; purchase_amount: number });

    case 'check_fraud_velocity':
      return checkFraudVelocity(users, transactions, args as { user_id: string });

    case 'generate_credit_narrative':
      return await generateCreditNarrative(users, transactions, args as { user_id: string });

    case 'get_payu_emi_options':
      return getPayuEmiOptions(users, transactions, args as { user_id: string; purchase_amount: number; merchant_name?: string });

    case 'confirm_emi_plan':
      return await confirmEmiPlan(users, transactions, args as { user_id: string; purchase_amount: number; selected_months: number; merchant_name?: string });

    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

// List resources
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [TXN_SCHEMA_DEF, MERCHANT_CATALOG_DEF],
}));

// Read resource
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case 'transaction://schema':
      return readTransactionSchema();

    case 'merchant://catalog':
      return merchantCatalogResult;

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// Start stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('GrabCredit MCP server running on stdio\n');
}

main().catch(err => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
