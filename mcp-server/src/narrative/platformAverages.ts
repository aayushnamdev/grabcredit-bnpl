import { UserProfile, Transaction } from '../types';
import { calculateCreditScore, CURRENT_DATE } from '../scoring/engine';
import { PlatformAverages } from './types';

export function computePlatformAverages(
  users: UserProfile[],
  transactions: Transaction[]
): PlatformAverages {
  // Score all users and filter out fraud-rejected
  const scored = users.map(user => {
    const userTxns = transactions.filter(t => t.user_id === user.user_id);
    const result = calculateCreditScore(user, userTxns, CURRENT_DATE);
    return { user, result };
  }).filter(({ result }) => result.tier !== 'fraud-rejected');

  const count = scored.length;
  if (count === 0) {
    return {
      avgMonthlySpend: 0,
      avgDealRedemptionRate: 0,
      avgReturnRate: 0,
      avgTotalTransactions: 0,
      avgCategoriesCount: 0,
      avgFactorScores: {
        purchaseConsistency: 0,
        dealEngagement: 0,
        financialTrajectory: 0,
        riskSignals: 0,
        accountMaturity: 0,
      },
      userCount: 0,
    };
  }

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  return {
    avgMonthlySpend: Math.round(sum(scored.map(s => s.user.avg_monthly_spend)) / count),
    avgDealRedemptionRate: parseFloat((sum(scored.map(s => s.user.deal_redemption_rate)) / count).toFixed(2)),
    avgReturnRate: parseFloat((sum(scored.map(s => s.user.return_rate)) / count).toFixed(2)),
    avgTotalTransactions: Math.round(sum(scored.map(s => s.user.total_transactions)) / count),
    avgCategoriesCount: parseFloat((sum(scored.map(s => s.user.categories_shopped.length)) / count).toFixed(1)),
    avgFactorScores: {
      purchaseConsistency: Math.round(sum(scored.map(s => s.result.factors.purchaseConsistency.score)) / count),
      dealEngagement: Math.round(sum(scored.map(s => s.result.factors.dealEngagement.score)) / count),
      financialTrajectory: Math.round(sum(scored.map(s => s.result.factors.financialTrajectory.score)) / count),
      riskSignals: Math.round(sum(scored.map(s => s.result.factors.riskSignals.score)) / count),
      accountMaturity: Math.round(sum(scored.map(s => s.result.factors.accountMaturity.score)) / count),
    },
    userCount: count,
  };
}
