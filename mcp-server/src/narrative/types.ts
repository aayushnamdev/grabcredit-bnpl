export interface PlatformAverages {
  avgMonthlySpend: number;
  avgDealRedemptionRate: number;
  avgReturnRate: number;
  avgTotalTransactions: number;
  avgCategoriesCount: number;
  avgFactorScores: {
    purchaseConsistency: number;
    dealEngagement: number;
    financialTrajectory: number;
    riskSignals: number;
    accountMaturity: number;
  };
  userCount: number;
}
