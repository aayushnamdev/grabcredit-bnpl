import { PayUClient, PayUEmiCreateRequest, PayUEmiCreateResponse } from './types';
import { buildSchedule, EMI_CONFIG } from './emiCalculator';

function dateToYYYYMMDD(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function randomHex(len: number): string {
  return Math.random().toString(16).slice(2, 2 + len).toUpperCase();
}

export class MockPayUClient implements PayUClient {
  async createEmiPlan(req: PayUEmiCreateRequest): Promise<PayUEmiCreateResponse> {
    // Simulated latency
    await new Promise(r => setTimeout(r, 150));

    const now = new Date();
    const mihpayid = 'MIHU' + Date.now() + Math.random().toString(36).slice(2, 6).toUpperCase();
    const emi_plan_id = 'EMIPLAN_' + dateToYYYYMMDD(now) + '_' + randomHex(4);
    const emi_start_date = now.toISOString().slice(0, 10);

    // _monthlyRate and _processingFee are injected by confirmEmiPlan, which has access to
    // the user's rateTier and the EMI_CONFIG. The PayU wire contract doesn't carry these
    // fields — they're internal-only and stripped before any real API call.
    const monthlyRate = (req as any)._monthlyRate as number ?? 0;
    const processingFee = (req as any)._processingFee as number ?? 0;

    const schedule = buildSchedule(req.amount, monthlyRate, req.emi_tenure, now);

    const total_amount = schedule.reduce((sum, s) => sum + s.amount, 0);
    const monthly_emi = schedule.length > 0 ? schedule[0].amount : Math.round(req.amount / req.emi_tenure);

    return {
      status: 'success',
      txnid: req.txnid,
      mihpayid,
      emi_plan_id,
      emi_tenure: req.emi_tenure,
      monthly_emi,
      emi_start_date,
      schedule,
      total_amount,
      processing_fee: processingFee,
      total_cost: total_amount + processingFee,
      mode: 'mock',
      timestamp: now.toISOString(),
    };
  }
}
