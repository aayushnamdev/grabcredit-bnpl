// Server-only module: loads MCP backend modules directly
// Only import this from API routes (server-side code)

import path from 'path';
import fs from 'fs';

// Use eval('require') to prevent Turbopack/Webpack from analyzing these dynamic imports
// eslint-disable-next-line no-eval
const dynamicRequire = eval('require') as NodeRequire;

// On Vercel the mcp-server dist is copied into web-app/mcp-server-dist during build.
// Locally it lives at ../mcp-server/dist (sibling directory).
const MCP_DIST = fs.existsSync(path.resolve(process.cwd(), 'mcp-server-dist'))
  ? path.resolve(process.cwd(), 'mcp-server-dist')
  : path.resolve(process.cwd(), '..', 'mcp-server', 'dist');

// Guard: give a clear error if the MCP server hasn't been built yet
if (!fs.existsSync(MCP_DIST)) {
  throw new Error(
    `\n\nMCP server is not built. Run these commands first:\n` +
    `  cd mcp-server && npm install && npm run build\n\n` +
    `Expected dist at: ${MCP_DIST}\n`
  );
}

let _users: any = null;
let _transactions: any = null;

function getUsers() {
  if (!_users) _users = dynamicRequire(path.join(MCP_DIST, 'data', 'users.json'));
  return _users;
}

function getTransactions() {
  if (!_transactions) _transactions = dynamicRequire(path.join(MCP_DIST, 'data', 'transactions.json'));
  return _transactions;
}

function loadTool(name: string) {
  return dynamicRequire(path.join(MCP_DIST, 'tools', name));
}

function loadNarrative(name: string) {
  return dynamicRequire(path.join(MCP_DIST, 'narrative', name));
}

// Unwrap MCP tool response: content[0].text → parsed JSON
function unwrap(result: { content: Array<{ type: string; text: string }>; isError?: boolean }) {
  if (result.isError) {
    throw new Error(result.content[0]?.text || 'Unknown backend error');
  }
  return JSON.parse(result.content[0].text);
}

function unwrapText(result: { content: Array<{ type: string; text: string }>; isError?: boolean }) {
  if (result.isError) {
    throw new Error(result.content[0]?.text || 'Unknown backend error');
  }
  return result.content[0].text;
}

export function callGetProfile(userId: string) {
  const { getUserProfile } = loadTool('getUserProfile');
  const result = getUserProfile(getUsers(), { user_id: userId });
  return unwrap(result);
}

export function callGetCreditScore(userId: string) {
  const { getCreditScore } = loadTool('getCreditScore');
  const result = getCreditScore(getUsers(), getTransactions(), { user_id: userId });
  return unwrap(result);
}

export function callGetPayuEmiOptions(userId: string, purchaseAmount: number, merchantName?: string) {
  const { getPayuEmiOptions } = loadTool('getPayuEmiOptions');
  const result = getPayuEmiOptions(getUsers(), getTransactions(), {
    user_id: userId,
    purchase_amount: purchaseAmount,
    merchant_name: merchantName,
  });
  return unwrap(result);
}

export async function callConfirmEmiPlan(
  userId: string,
  purchaseAmount: number,
  selectedMonths: number,
  merchantName?: string
) {
  const { confirmEmiPlan } = loadTool('confirmEmiPlan');
  const result = await confirmEmiPlan(getUsers(), getTransactions(), {
    user_id: userId,
    purchase_amount: purchaseAmount,
    selected_months: selectedMonths,
    merchant_name: merchantName,
  });
  return unwrap(result);
}

export function callCheckFraudVelocity(userId: string) {
  const { checkFraudVelocity } = loadTool('checkFraudVelocity');
  const result = checkFraudVelocity(getUsers(), getTransactions(), { user_id: userId });
  return unwrap(result);
}

export function callGetPlatformAverages() {
  const { computePlatformAverages } = loadNarrative('platformAverages');
  return computePlatformAverages(getUsers(), getTransactions());
}
