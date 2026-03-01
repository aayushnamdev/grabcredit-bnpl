import * as fs from 'fs';
import * as path from 'path';
import { UserProfile, Transaction, ScoreResult } from '../types';
import { calculateCreditScore, CURRENT_DATE } from './engine';

const dataDir = path.join(__dirname, '..', 'data');
const users: UserProfile[] = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf-8'));
const transactions: Transaction[] = JSON.parse(fs.readFileSync(path.join(dataDir, 'transactions.json'), 'utf-8'));

// Expected tier for each persona
const EXPECTED_TIERS: Record<string, { tier: ScoreResult['tier']; minScore: number; maxScore: number }> = {
  user_001: { tier: 'pre-approved', minScore: 800, maxScore: 1000 },
  user_002: { tier: 'approved',     minScore: 600, maxScore: 799 },
  user_003: { tier: 'conditional',  minScore: 400, maxScore: 599 },
  user_004: { tier: 'rejected',     minScore: 200, maxScore: 399 },
  user_005: { tier: 'fraud-rejected', minScore: 0, maxScore: 199 },
};

console.log(`\n${'═'.repeat(70)}`);
console.log(`  GrabCredit Scoring Engine — Verification`);
console.log(`  Current Date: ${CURRENT_DATE.toISOString().split('T')[0]}`);
console.log(`${'═'.repeat(70)}\n`);

let allPassed = true;

for (const user of users) {
  const result = calculateCreditScore(user, transactions, CURRENT_DATE);
  const expected = EXPECTED_TIERS[user.user_id];
  const tierMatch = result.tier === expected.tier;
  const scoreInRange = result.score >= expected.minScore && result.score <= expected.maxScore;
  const passed = tierMatch && scoreInRange;
  if (!passed) allPassed = false;

  const status = passed ? '✓ PASS' : '✗ FAIL';
  const limitStr = result.creditLimit > 0 ? `₹${result.creditLimit.toLocaleString('en-IN')}` : '₹0';

  console.log(`${user.user_id} (${user.name}):`);
  console.log(`  Score=${result.score}  Tier=${result.tier}  Limit=${limitStr}  ${status}`);

  if (!passed) {
    console.log(`  Expected: tier=${expected.tier}, score ${expected.minScore}-${expected.maxScore}`);
  }

  // Fraud flags
  if (result.fraudFlags.flagged) {
    console.log(`  Fraud: [${result.fraudFlags.action}]`);
    for (const flag of result.fraudFlags.flags) {
      console.log(`    - ${flag}`);
    }
  }

  // Factor details
  if (result.tier !== 'fraud-rejected') {
    const f = result.factors;
    console.log(`  Factors:`);
    console.log(`    Purchase Consistency: ${f.purchaseConsistency.score} (×${f.purchaseConsistency.weight})`);
    for (const r of f.purchaseConsistency.reasons) console.log(`      ${r}`);
    console.log(`    Deal Engagement:      ${f.dealEngagement.score} (×${f.dealEngagement.weight})`);
    for (const r of f.dealEngagement.reasons) console.log(`      ${r}`);
    console.log(`    Financial Trajectory: ${f.financialTrajectory.score} (×${f.financialTrajectory.weight})`);
    for (const r of f.financialTrajectory.reasons) console.log(`      ${r}`);
    console.log(`    Risk Signals:         ${f.riskSignals.score} (×${f.riskSignals.weight})`);
    for (const r of f.riskSignals.reasons) console.log(`      ${r}`);
    console.log(`    Account Maturity:     ${f.accountMaturity.score} (×${f.accountMaturity.weight})`);
    for (const r of f.accountMaturity.reasons) console.log(`      ${r}`);
  }
  console.log();
}

console.log(`${'═'.repeat(70)}`);
console.log(`  Overall: ${allPassed ? '✓ ALL PASSED' : '✗ SOME FAILED'}`);
console.log(`${'═'.repeat(70)}\n`);

process.exit(allPassed ? 0 : 1);
