import * as fs from 'fs';
import * as path from 'path';
import { UserProfile, Transaction } from '../types';
import { calculateCreditScore, CURRENT_DATE } from '../scoring/engine';
import { computePlatformAverages } from './platformAverages';
import { generateNarrative } from './generator';

const dataDir = path.join(__dirname, '..', 'data');
const users: UserProfile[] = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf-8'));
const transactions: Transaction[] = JSON.parse(fs.readFileSync(path.join(dataDir, 'transactions.json'), 'utf-8'));

async function main() {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  GrabCredit Narrative Generation — Test Run`);
  console.log(`  Current Date: ${CURRENT_DATE.toISOString().split('T')[0]}`);
  console.log(`${'═'.repeat(70)}\n`);

  // Compute platform averages once
  const platformAverages = computePlatformAverages(users, transactions);
  console.log('Platform Averages (excluding fraud-rejected):');
  console.log(`  Avg Monthly Spend: ₹${platformAverages.avgMonthlySpend.toLocaleString('en-IN')}`);
  console.log(`  Avg Deal Redemption Rate: ${platformAverages.avgDealRedemptionRate}`);
  console.log(`  Avg Return Rate: ${platformAverages.avgReturnRate}`);
  console.log(`  Avg Total Transactions: ${platformAverages.avgTotalTransactions}`);
  console.log(`  Avg Categories Count: ${platformAverages.avgCategoriesCount}`);
  console.log(`  Avg Factor Scores:`);
  const fs_ = platformAverages.avgFactorScores;
  console.log(`    Purchase Consistency: ${fs_.purchaseConsistency}`);
  console.log(`    Deal Engagement: ${fs_.dealEngagement}`);
  console.log(`    Financial Trajectory: ${fs_.financialTrajectory}`);
  console.log(`    Risk Signals: ${fs_.riskSignals}`);
  console.log(`    Account Maturity: ${fs_.accountMaturity}`);
  console.log(`  Users included: ${platformAverages.userCount}`);
  console.log();

  // Generate narrative for each user
  for (const user of users) {
    const userTxns = transactions.filter(t => t.user_id === user.user_id);
    const result = calculateCreditScore(user, userTxns, CURRENT_DATE);
    const limitStr = result.creditLimit > 0 ? `₹${result.creditLimit.toLocaleString('en-IN')}` : '₹0';

    console.log(`${'─'.repeat(70)}`);
    console.log(`  ${user.user_id} (${user.name})`);
    console.log(`  Score: ${result.score} | Tier: ${result.tier} | Limit: ${limitStr} | Rate Tier: ${result.rateTier}`);
    console.log(`${'─'.repeat(70)}`);

    const narrative = await generateNarrative(user, result, platformAverages);
    console.log(`\n${narrative}\n`);
  }

  console.log(`${'═'.repeat(70)}`);
  console.log(`  Done — ${users.length} narratives generated`);
  console.log(`${'═'.repeat(70)}\n`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
