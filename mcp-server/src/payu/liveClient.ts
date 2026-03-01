import * as crypto from 'crypto';
import { PayUClient, PayUEmiCreateRequest, PayUEmiCreateResponse } from './types';

const PAYU_SANDBOX_URL = 'https://sandboxsecure.payu.in/merchant/postservice?form=2';

export class LivePayUClient implements PayUClient {
  private readonly key: string;
  private readonly salt: string;

  constructor() {
    const key = process.env.PAYU_KEY;
    const salt = process.env.PAYU_SALT;
    if (!key || !salt) {
      throw new Error('[Live mode not configured: missing PAYU_KEY/PAYU_SALT]');
    }
    this.key = key;
    this.salt = salt;
  }

  private computeHash(req: PayUEmiCreateRequest): string {
    // PayU hash: sha512(key|txnid|amount|productinfo|firstname|email|||||||||||salt)
    const hashString = [
      this.key,
      req.txnid,
      req.amount,
      req.productinfo,
      req.firstname,
      req.email,
      '', '', '', '', '', '', '', '', '', '',
      this.salt,
    ].join('|');
    return crypto.createHash('sha512').update(hashString).digest('hex');
  }

  async createEmiPlan(req: PayUEmiCreateRequest): Promise<PayUEmiCreateResponse> {
    const hash = this.computeHash(req);

    const payload = new URLSearchParams({
      key: this.key,
      txnid: req.txnid,
      amount: String(req.amount),
      productinfo: req.productinfo,
      firstname: req.firstname,
      email: req.email,
      phone: req.phone,
      emi_tenure: String(req.emi_tenure),
      payment_type: req.payment_type,
      hash,
    });

    const response = await fetch(PAYU_SANDBOX_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload.toString(),
    });

    if (!response.ok) {
      return {
        status: 'failure',
        txnid: req.txnid,
        mihpayid: '',
        emi_plan_id: '',
        emi_tenure: req.emi_tenure,
        monthly_emi: 0,
        emi_start_date: '',
        schedule: [],
        total_amount: 0,
        processing_fee: 0,
        total_cost: 0,
        mode: 'live',
        timestamp: new Date().toISOString(),
        error_code: String(response.status),
        error_message: `PayU sandbox returned HTTP ${response.status}`,
      };
    }

    const data = await response.json() as any;

    return {
      status: data.status === '1' ? 'success' : 'failure',
      txnid: data.txnid ?? req.txnid,
      mihpayid: data.mihpayid ?? '',
      emi_plan_id: data.emi_plan_id ?? '',
      emi_tenure: req.emi_tenure,
      monthly_emi: data.monthly_emi ?? 0,
      emi_start_date: data.emi_start_date ?? '',
      schedule: data.schedule ?? [],
      total_amount: data.total_amount ?? 0,
      processing_fee: data.processing_fee ?? 0,
      total_cost: data.total_cost ?? 0,
      mode: 'live',
      timestamp: new Date().toISOString(),
      error_code: data.error_code,
      error_message: data.error_message,
    };
  }
}
