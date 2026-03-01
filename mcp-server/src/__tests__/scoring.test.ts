import * as fs from 'fs';
import * as path from 'path';
import { UserProfile, Transaction } from '../types';
import { calculateCreditScore, CURRENT_DATE } from '../scoring/engine';
import { checkFraudFlags } from '../scoring/fraudDetection';

// ── Load fixtures ─────────────────────────────────────────────────────────────

const dataDir = path.join(__dirname, '..', 'data');
const USERS: UserProfile[] = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf-8'));
const TRANSACTIONS: Transaction[] = JSON.parse(fs.readFileSync(path.join(dataDir, 'transactions.json'), 'utf-8'));

function getUser(id: string) {
  const u = USERS.find(u => u.user_id === id);
  if (!u) throw new Error(`User not found: ${id}`);
  return u;
}

function getTxns(userId: string) {
  return TRANSACTIONS.filter(t => t.user_id === userId);
}

// ── Persona tier assertions ───────────────────────────────────────────────────

describe('Scoring Engine — Persona Tiers', () => {
  test('user_001 (Priya Sharma) → pre-approved, score ≥ 800', () => {
    const result = calculateCreditScore(getUser('user_001'), getTxns('user_001'), CURRENT_DATE);
    expect(result.tier).toBe('pre-approved');
    expect(result.score).toBeGreaterThanOrEqual(800);
    expect(result.creditLimit).toBeGreaterThanOrEqual(50000);
    expect(result.rateTier).toBe(1);
  });

  test('user_002 (Rahul Verma) → approved, score 600–799', () => {
    const result = calculateCreditScore(getUser('user_002'), getTxns('user_002'), CURRENT_DATE);
    expect(result.tier).toBe('approved');
    expect(result.score).toBeGreaterThanOrEqual(600);
    expect(result.score).toBeLessThanOrEqual(799);
    expect(result.rateTier).toBe(2);
  });

  test('user_003 (Ananya Iyer) → conditional, score 400–599', () => {
    const result = calculateCreditScore(getUser('user_003'), getTxns('user_003'), CURRENT_DATE);
    expect(result.tier).toBe('conditional');
    expect(result.score).toBeGreaterThanOrEqual(400);
    expect(result.score).toBeLessThanOrEqual(599);
    expect(result.rateTier).toBe(3);
  });

  test('user_004 (Vikram Singh) → rejected, score < 400', () => {
    const result = calculateCreditScore(getUser('user_004'), getTxns('user_004'), CURRENT_DATE);
    expect(result.tier).toBe('rejected');
    expect(result.score).toBeLessThan(400);
    expect(result.creditLimit).toBe(0);
    expect(result.rateTier).toBe(0);
  });

  test('user_005 (Ghost User) → fraud-rejected', () => {
    const result = calculateCreditScore(getUser('user_005'), getTxns('user_005'), CURRENT_DATE);
    expect(result.tier).toBe('fraud-rejected');
    expect(result.creditLimit).toBe(0);
    expect(result.rateTier).toBe(0);
    expect(result.fraudFlags.action).toBe('auto-reject');
  });
});

// ── Credit limit interpolation ────────────────────────────────────────────────

describe('Scoring Engine — Credit Limit Interpolation', () => {
  test('score exactly 800 → limit at lower end of pre-approved range (≥ ₹50,000)', () => {
    const result = calculateCreditScore(getUser('user_001'), getTxns('user_001'), CURRENT_DATE);
    // Priya is pre-approved; limit should interpolate within 50K–100K based on score
    expect(result.creditLimit).toBeGreaterThanOrEqual(50000);
    expect(result.creditLimit).toBeLessThanOrEqual(100000);
  });

  test('pre-approved user has higher limit than approved user', () => {
    const priya = calculateCreditScore(getUser('user_001'), getTxns('user_001'), CURRENT_DATE);
    const rahul = calculateCreditScore(getUser('user_002'), getTxns('user_002'), CURRENT_DATE);
    expect(priya.creditLimit).toBeGreaterThan(rahul.creditLimit);
  });

  test('approved user has higher limit than conditional user', () => {
    const rahul = calculateCreditScore(getUser('user_002'), getTxns('user_002'), CURRENT_DATE);
    const ananya = calculateCreditScore(getUser('user_003'), getTxns('user_003'), CURRENT_DATE);
    expect(rahul.creditLimit).toBeGreaterThan(ananya.creditLimit);
  });
});

// ── Data confidence dampener ──────────────────────────────────────────────────

describe('Scoring Engine — Confidence Dampener', () => {
  test('thin-data user (Ananya, 3 months) has dataConfidence < 0.4', () => {
    const result = calculateCreditScore(getUser('user_003'), getTxns('user_003'), CURRENT_DATE);
    expect(result.dataConfidence).toBeLessThan(0.4);
  });

  test('mature user (Priya, 18 months) has higher confidence than new user', () => {
    const priya = calculateCreditScore(getUser('user_001'), getTxns('user_001'), CURRENT_DATE);
    const ananya = calculateCreditScore(getUser('user_003'), getTxns('user_003'), CURRENT_DATE);
    expect(priya.dataConfidence).toBeGreaterThan(ananya.dataConfidence);
  });

  test('user with 0 transactions gets rejected (not falsely conditional at dampened 500)', () => {
    const zeroTxnUser: UserProfile = {
      ...getUser('user_002'),
      user_id: 'test_zero',
      total_transactions: 0,
      active_months: 0,
    };
    const result = calculateCreditScore(zeroTxnUser, [], CURRENT_DATE);
    expect(result.tier).toBe('rejected');
    expect(result.score).toBe(0);
  });

  test('user with 2 transactions (below minimum) gets rejected', () => {
    const sparseUser: UserProfile = {
      ...getUser('user_002'),
      user_id: 'test_sparse',
      total_transactions: 2,
      active_months: 1,
    };
    const sparseTxns = getTxns('user_002').slice(0, 2).map(t => ({ ...t, user_id: 'test_sparse' }));
    const result = calculateCreditScore(sparseUser, sparseTxns, CURRENT_DATE);
    expect(result.tier).toBe('rejected');
  });
});

// ── Fraud detection boundary tests ────────────────────────────────────────────

describe('Fraud Detection — 7-Day Account Age Rule', () => {
  const base: UserProfile = getUser('user_001');

  test('account exactly 6 days old → auto-rejected (below 7-day threshold)', () => {
    const sixDaysAgo = new Date(CURRENT_DATE);
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
    const user: UserProfile = { ...base, user_id: 'test_6days', registration_date: sixDaysAgo.toISOString() };
    const result = checkFraudFlags(user, [], CURRENT_DATE);
    expect(result.action).toBe('auto-reject');
    expect(result.flags.some(f => f.includes('too new for BNPL'))).toBe(true);
  });

  test('account exactly 7 days old → passes 7-day rule', () => {
    const sevenDaysAgo = new Date(CURRENT_DATE);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const user: UserProfile = { ...base, user_id: 'test_7days', registration_date: sevenDaysAgo.toISOString() };
    const result = checkFraudFlags(user, [], CURRENT_DATE);
    expect(result.flags.some(f => f.includes('too new for BNPL'))).toBe(false);
  });

  test('account 8 days old → no age flag', () => {
    const eightDaysAgo = new Date(CURRENT_DATE);
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
    const user: UserProfile = { ...base, user_id: 'test_8days', registration_date: eightDaysAgo.toISOString() };
    const result = checkFraudFlags(user, [], CURRENT_DATE);
    expect(result.flags.some(f => f.includes('too new for BNPL'))).toBe(false);
  });
});

describe('Fraud Detection — Single-Pattern Combo', () => {
  test('new account + single payment mode + single category + 0% coupons → auto-reject', () => {
    const threeDaysAgo = new Date(CURRENT_DATE);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const user: UserProfile = {
      ...getUser('user_005'),
      user_id: 'test_combo',
      registration_date: threeDaysAgo.toISOString(),
      deal_redemption_rate: 0,
    };
    const txns: Transaction[] = [
      {
        transaction_id: 't1',
        user_id: 'test_combo',
        timestamp: threeDaysAgo.toISOString(),
        merchant_name: 'Samsung',
        merchant_category: 'Electronics',
        transaction_amount: 45000,
        payment_mode: 'COD',
        coupon_used: false,
        coupon_discount_percent: 0,
        return_flag: false,
        refund_amount: 0,
        subcategory: 'Smartphones',
        device_type: 'mobile',
      },
      {
        transaction_id: 't2',
        user_id: 'test_combo',
        timestamp: threeDaysAgo.toISOString(),
        merchant_name: 'Apple',
        merchant_category: 'Electronics',
        transaction_amount: 40000,
        payment_mode: 'COD',
        coupon_used: false,
        coupon_discount_percent: 0,
        return_flag: false,
        refund_amount: 0,
        subcategory: 'Smartphones',
        device_type: 'mobile',
      },
    ];
    const result = checkFraudFlags(user, txns, CURRENT_DATE);
    expect(result.action).toBe('auto-reject');
    expect(result.flags.some(f => f.includes('Single-pattern combo') || f.includes('single payment mode'))).toBe(true);
  });
});

describe('Fraud Detection — Ghost User (user_005)', () => {
  test('Ghost User triggers auto-reject with multiple flags', () => {
    const fraud = checkFraudFlags(getUser('user_005'), getTxns('user_005'), CURRENT_DATE);
    expect(fraud.flagged).toBe(true);
    expect(fraud.action).toBe('auto-reject');
    expect(fraud.flags.length).toBeGreaterThanOrEqual(2);
  });

  test('Ghost User full score → fraud-rejected, score = 0, limit = 0', () => {
    const result = calculateCreditScore(getUser('user_005'), getTxns('user_005'), CURRENT_DATE);
    expect(result.tier).toBe('fraud-rejected');
    expect(result.score).toBe(0);
    expect(result.creditLimit).toBe(0);
  });
});

// ── Factor weights sum to 1.0 ─────────────────────────────────────────────────

describe('Scoring Engine — Factor Weight Integrity', () => {
  test('all factor weights sum to exactly 1.0', () => {
    const result = calculateCreditScore(getUser('user_001'), getTxns('user_001'), CURRENT_DATE);
    const total =
      result.factors.purchaseConsistency.weight +
      result.factors.dealEngagement.weight +
      result.factors.financialTrajectory.weight +
      result.factors.riskSignals.weight +
      result.factors.accountMaturity.weight;
    expect(total).toBeCloseTo(1.0, 5);
  });

  test('all factor scores are in range 0–100', () => {
    const result = calculateCreditScore(getUser('user_001'), getTxns('user_001'), CURRENT_DATE);
    for (const factor of Object.values(result.factors)) {
      expect(factor.score).toBeGreaterThanOrEqual(0);
      expect(factor.score).toBeLessThanOrEqual(100);
    }
  });

  test('final score is in range 0–1000', () => {
    for (const user of USERS) {
      const result = calculateCreditScore(user, getTxns(user.user_id), CURRENT_DATE);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1000);
    }
  });
});
