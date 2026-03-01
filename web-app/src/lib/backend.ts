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

export async function callPayFull(userId: string, purchaseAmount: number, merchantName?: string) {
  const profile = getUsers().find((u: any) => u.user_id === userId);
  const mode = process.env.PAYU_MODE ?? 'mock';
  const txnid = `GC_FULL_${userId}_${Date.now()}`;
  const productinfo = merchantName ?? 'GrabOn Purchase';
  const returnUrl = process.env.PAYU_RETURN_URL ?? 'https://grabcredit-bnpl.vercel.app/payment/callback';
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  if (mode !== 'live') {
    return {
      status: 'success' as const,
      txnid,
      mihpayid: `MOCK_${Date.now()}`,
      emi_plan_id: `PLAN_FULL_${Date.now()}`,
      emi_tenure: 1,
      monthly_emi: purchaseAmount,
      emi_start_date: today,
      schedule: [{ installment: 1, due_date: today, amount: purchaseAmount, principal: purchaseAmount, interest: 0 }],
      total_amount: purchaseAmount,
      processing_fee: 0,
      total_cost: purchaseAmount,
      mode: 'mock' as const,
      timestamp: now,
    };
  }

  const crypto = dynamicRequire('crypto');
  const key = process.env.PAYU_KEY ?? '';
  const salt = process.env.PAYU_SALT ?? '';
  const amountStr = purchaseAmount.toFixed(2);
  const firstname = profile?.name?.split(' ')[0] ?? 'Customer';
  const email = profile?.email ?? 'customer@example.com';

  const parts = [key, txnid, amountStr, productinfo, firstname, email, '', '', '', '', '', '', '', '', '', '', salt];
  const hash = crypto.createHash('sha512').update(parts.join('|')).digest('hex');

  return {
    status: 'pending' as const,
    txnid,
    mihpayid: '',
    emi_plan_id: '',
    emi_tenure: 1,
    monthly_emi: purchaseAmount,
    emi_start_date: today,
    schedule: [],
    total_amount: purchaseAmount,
    processing_fee: 0,
    total_cost: purchaseAmount,
    mode: 'live' as const,
    timestamp: now,
    payu_redirect_url: 'https://test.payu.in/_payment',
    payu_params: { key, txnid, amount: amountStr, productinfo, firstname, email, surl: returnUrl, furl: returnUrl, hash },
  };
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
