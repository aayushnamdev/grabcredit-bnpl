import { UserProfile, Transaction, FraudResult } from '../types';

const FRAUD_THRESHOLDS = {
  MIN_ACCOUNT_AGE_DAYS: 7,
  VELOCITY_SPIKE_AMOUNT: 20000,
  VELOCITY_SPIKE_HOURS: 48,
  CATEGORY_CONCENTRATION_PCT: 0.80,
  NEW_ACCOUNT_DAYS: 30,
  ELECTRONICS_CONCENTRATION_PCT: 0.80,
  ELECTRONICS_MIN_TXNS: 10,
  DORMANT_ACCOUNT_AGE_DAYS: 90,  // Account older than this with zero transactions is suspicious
};

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function hoursBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60);
}

export function checkFraudFlags(
  profile: UserProfile,
  transactions: Transaction[],
  currentDate: Date
): FraudResult {
  const flags: { message: string; action: 'auto-reject' | 'review' | 'monitor' }[] = [];
  const regDate = new Date(profile.registration_date);
  const daysSinceReg = daysBetween(regDate, currentDate);
  const userTxns = transactions.filter(t => t.user_id === profile.user_id);

  // Flag 1: New Account BNPL — account < 7 days old
  if (daysSinceReg < FRAUD_THRESHOLDS.MIN_ACCOUNT_AGE_DAYS) {
    flags.push({
      message: `New account (${daysSinceReg} days old) — too new for BNPL`,
      action: 'auto-reject',
    });
  }

  // Flag 2: Spend Velocity Spike — >₹20K within first 48hrs of registration
  const first48hTxns = userTxns.filter(t => {
    const txnDate = new Date(t.timestamp);
    return hoursBetween(regDate, txnDate) <= FRAUD_THRESHOLDS.VELOCITY_SPIKE_HOURS && hoursBetween(regDate, txnDate) >= 0;
  });
  const first48hSum = first48hTxns.reduce((sum, t) => sum + t.transaction_amount, 0);
  if (first48hSum > FRAUD_THRESHOLDS.VELOCITY_SPIKE_AMOUNT) {
    flags.push({
      message: `Velocity spike: ₹${first48hSum.toLocaleString('en-IN')} spent in first 48hrs`,
      action: 'review',
    });
  }

  // Flag 3: Category Jump — >80% GMV in one category + sudden high-value txn in different category
  if (userTxns.length > 0) {
    const categoryGmv: Record<string, number> = {};
    let totalGmv = 0;
    for (const t of userTxns) {
      categoryGmv[t.merchant_category] = (categoryGmv[t.merchant_category] || 0) + t.transaction_amount;
      totalGmv += t.transaction_amount;
    }
    if (totalGmv > 0) {
      const avgTxnAmount = totalGmv / userTxns.length;
      let dominantCategory = '';
      let dominantPct = 0;
      for (const [cat, gmv] of Object.entries(categoryGmv)) {
        const pct = gmv / totalGmv;
        if (pct > dominantPct) {
          dominantPct = pct;
          dominantCategory = cat;
        }
      }
      if (dominantPct > FRAUD_THRESHOLDS.CATEGORY_CONCENTRATION_PCT) {
        const outlierTxns = userTxns.filter(
          t => t.merchant_category !== dominantCategory && t.transaction_amount > avgTxnAmount * 2
        );
        if (outlierTxns.length > 0) {
          flags.push({
            message: `Category jump: ${(dominantPct * 100).toFixed(0)}% in ${dominantCategory}, high-value txn in other category`,
            action: 'review',
          });
        }
      }
    }
  }

  // Flag 4: Single-Pattern Combo — <30 days + single payment mode + single category + 0% coupons
  if (daysSinceReg < FRAUD_THRESHOLDS.NEW_ACCOUNT_DAYS) {
    const uniquePayModes = new Set(userTxns.map(t => t.payment_mode));
    const uniqueCategories = new Set(userTxns.map(t => t.merchant_category));
    if (
      uniquePayModes.size === 1 &&
      uniqueCategories.size === 1 &&
      profile.deal_redemption_rate === 0
    ) {
      flags.push({
        message: `Single-pattern combo: <30 days, single payment mode (${[...uniquePayModes][0]}), single category (${[...uniqueCategories][0]}), no coupons`,
        action: 'auto-reject',
      });
    }
  }

  // Flag 5: Electronics Concentration — >80% GMV in Electronics + <10 total txns
  if (userTxns.length > 0 && profile.total_transactions < FRAUD_THRESHOLDS.ELECTRONICS_MIN_TXNS) {
    const elecGmv = userTxns
      .filter(t => t.merchant_category === 'Electronics')
      .reduce((sum, t) => sum + t.transaction_amount, 0);
    const totalGmv = userTxns.reduce((sum, t) => sum + t.transaction_amount, 0);
    if (totalGmv > 0 && elecGmv / totalGmv > FRAUD_THRESHOLDS.ELECTRONICS_CONCENTRATION_PCT) {
      flags.push({
        message: `Electronics concentration: ${((elecGmv / totalGmv) * 100).toFixed(0)}% GMV in Electronics with only ${profile.total_transactions} txns`,
        action: 'monitor',
      });
    }
  }

  // Flag 6: Dormant Account — old account with zero transactions seeking BNPL
  // This is a different risk profile from a new account: the account has had
  // plenty of time to build history but hasn't. Could indicate account takeover,
  // synthetic identity, or an account created speculatively for later fraud use.
  if (daysSinceReg > FRAUD_THRESHOLDS.DORMANT_ACCOUNT_AGE_DAYS && profile.total_transactions === 0) {
    flags.push({
      message: `Dormant account: registered ${daysSinceReg} days ago with 0 transactions — insufficient purchase history for BNPL`,
      action: 'review',
    });
  }

  // Determine overall action
  const hasAutoReject = flags.some(f => f.action === 'auto-reject');
  const hasReview = flags.some(f => f.action === 'review');

  return {
    flagged: flags.length > 0,
    flags: flags.map(f => `[${f.action.toUpperCase()}] ${f.message}`),
    action: hasAutoReject ? 'auto-reject' : hasReview ? 'review' : 'none',
  };
}
