import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
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
  { capabilities: { tools: {}, resources: {}, prompts: {} } }
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

// ── MCP Prompts ──────────────────────────────────────────────────────────────
// Pre-built prompt templates that make GrabCredit immediately useful in Claude
// Desktop without requiring the user to know the right tool sequence.

const PROMPTS = [
  {
    name: 'full_credit_assessment',
    description: 'Complete credit assessment for a user — profile, score, fraud check, EMI options, and narrative in one go.',
    arguments: [
      { name: 'user_id', description: 'The user ID to assess (e.g. user_001)', required: true },
      { name: 'purchase_amount', description: 'Purchase amount in INR to check EMI eligibility for', required: false },
    ],
  },
  {
    name: 'compare_risk_profiles',
    description: 'Compare the credit risk profiles of two users side by side.',
    arguments: [
      { name: 'user_id_a', description: 'First user ID', required: true },
      { name: 'user_id_b', description: 'Second user ID', required: true },
    ],
  },
  {
    name: 'improvement_roadmap',
    description: 'Generate a personalised improvement roadmap for a rejected or conditional user, explaining exactly what they need to do to reach the next credit tier.',
    arguments: [
      { name: 'user_id', description: 'The user ID (works best for rejected/conditional users)', required: true },
    ],
  },
  {
    name: 'fraud_deep_dive',
    description: 'Run a detailed fraud analysis on a user — flags, risk reasoning, and recommended action.',
    arguments: [
      { name: 'user_id', description: 'The user ID to investigate', required: true },
    ],
  },
];

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: PROMPTS,
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'full_credit_assessment': {
      const userId = args?.user_id ?? 'user_001';
      const amount = args?.purchase_amount ? ` for a purchase of ₹${args.purchase_amount}` : '';
      return {
        description: `Full credit assessment for ${userId}`,
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Please run a complete GrabCredit assessment for user "${userId}"${amount}.\n\n` +
              `1. Use get_user_profile to get their profile.\n` +
              `2. Use check_fraud_velocity to check for fraud flags.\n` +
              `3. Use get_credit_score to get their full score and tier.\n` +
              `4. Use generate_credit_narrative to get the AI explanation.\n` +
              (args?.purchase_amount
                ? `5. Use get_payu_emi_options with purchase_amount=${args.purchase_amount} to show available EMI plans.\n`
                : '') +
              `\nSummarise: tier, credit limit, key scoring factors, and any fraud flags. ` +
              `Present the narrative as the human-facing explanation.`,
          },
        }],
      };
    }

    case 'compare_risk_profiles': {
      const a = args?.user_id_a ?? 'user_001';
      const b = args?.user_id_b ?? 'user_002';
      return {
        description: `Risk profile comparison: ${a} vs ${b}`,
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Compare the credit risk profiles of "${a}" and "${b}".\n\n` +
              `For each user:\n` +
              `- get_user_profile\n` +
              `- get_credit_score\n` +
              `- check_fraud_velocity\n\n` +
              `Then produce a side-by-side comparison table covering: score, tier, credit limit, ` +
              `top 2 scoring factors, data confidence, and fraud status. ` +
              `Conclude with which user is a better credit risk and why.`,
          },
        }],
      };
    }

    case 'improvement_roadmap': {
      const userId = args?.user_id ?? 'user_004';
      return {
        description: `Improvement roadmap for ${userId}`,
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Generate a personalised improvement roadmap for user "${userId}".\n\n` +
              `1. Use get_credit_score to get their current score, tier, and factor breakdown.\n` +
              `2. Use get_user_profile to understand their shopping behaviour.\n\n` +
              `Then write a clear, actionable roadmap:\n` +
              `- Current tier and score\n` +
              `- Which tier they should target next and how many points they need\n` +
              `- Top 2-3 specific behaviour changes that would move the needle most (with numbers: ` +
              `e.g. "spend ₹3,000/month for 3 consecutive months" not "spend more regularly")\n` +
              `- Realistic timeline estimate\n` +
              `- What their credit limit and rate would be at the next tier`,
          },
        }],
      };
    }

    case 'fraud_deep_dive': {
      const userId = args?.user_id ?? 'user_005';
      return {
        description: `Fraud deep dive for ${userId}`,
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Run a detailed fraud analysis for user "${userId}".\n\n` +
              `1. Use get_user_profile to understand account age and behaviour.\n` +
              `2. Use get_transaction_history to review recent transactions.\n` +
              `3. Use check_fraud_velocity to get the fraud flags.\n\n` +
              `Analyse: which specific fraud flags triggered, what the signals mean, ` +
              `whether the pattern looks like account takeover / synthetic identity / ` +
              `organised fraud / legitimate new user, and what the recommended action is ` +
              `(approve with monitoring / manual review / auto-reject).`,
          },
        }],
      };
    }

    default:
      throw new Error(`Unknown prompt: ${name}`);
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
