import * as crypto from 'crypto';
import { PayUClient, PayUEmiCreateRequest, PayUEmiCreateResponse } from './types';

// PayU sandbox payment endpoint (browser form POST — not a server-to-server JSON API)
const PAYU_SANDBOX_URL = 'https://test.payu.in/_payment';

export class LivePayUClient implements PayUClient {
  private readonly key: string;
  private readonly salt: string;

  constructor() {
    const key = process.env.PAYU_KEY;
    const salt = process.env.PAYU_SALT;
    if (!key || !salt) {
      throw new Error('Live mode not configured: set PAYU_KEY and PAYU_SALT environment variables');
    }
    this.key = key;
    this.salt = salt;
  }

  /**
   * PayU hash formula (request):
   *   sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt)
   * Equivalent string concat (from PayU docs):
   *   key+'|'+txnid+'|'+amount+'|'+productinfo+'|'+firstname+'|'+email+'|'+udf1+'|'+udf2+'|'+udf3+'|'+udf4+'|'+udf5+'||||||'+salt
   * Where udf1–udf5 are all empty → 5 empty + 5 empty (from '||||||') = 10 empty fields, 16 pipes total.
   */
  private computeRequestHash(req: PayUEmiCreateRequest, amountStr: string): string {
    const parts = [
      this.key,
      req.txnid,
      amountStr,
      req.productinfo,
      req.firstname,
      req.email,
      // udf1–udf5 (all empty)
      '', '', '', '', '',
      // 5 additional empty fields (the '||||||' in PayU's concat formula = 5 empties before salt)
      '', '', '', '', '',
      this.salt,
    ];
    return crypto.createHash('sha512').update(parts.join('|')).digest('hex');
  }

  async createEmiPlan(req: PayUEmiCreateRequest): Promise<PayUEmiCreateResponse> {
    // PayU requires amount as a string with exactly 2 decimal places
    const amountStr = req.amount.toFixed(2);
    const hash = this.computeRequestHash(req, amountStr);

    const processingFee = (req as any)._processingFee as number ?? 0;

    const surl = req.surl ?? 'https://grabcredit-bnpl.vercel.app/payment/callback';
    const furl = req.furl ?? 'https://grabcredit-bnpl.vercel.app/payment/callback';

    // PayU payment is a browser redirect flow, not a server-to-server JSON API.
    // We return the payment params + hash so the frontend can POST them to PayU's
    // sandbox payment page. PayU will validate the hash and process the payment.
    const payu_params: Record<string, string> = {
      key: this.key,
      txnid: req.txnid,
      amount: amountStr,
      productinfo: req.productinfo,
      firstname: req.firstname,
      email: req.email,
      phone: req.phone,
      surl,
      furl,
      hash,
      // LazyPay EMI specific params
      payment_type: req.payment_type,
      emi_tenure: String(req.emi_tenure),
    };

    return {
      status: 'pending',
      txnid: req.txnid,
      mihpayid: '',
      emi_plan_id: '',
      emi_tenure: req.emi_tenure,
      monthly_emi: 0,
      emi_start_date: '',
      schedule: [],
      total_amount: req.amount,
      processing_fee: processingFee,
      total_cost: req.amount + processingFee,
      mode: 'live',
      timestamp: new Date().toISOString(),
      payu_redirect_url: PAYU_SANDBOX_URL,
      payu_params,
    };
  }
}
