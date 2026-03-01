// generate_transactions.js v2 — budget-constrained
// Monthly GMV targets are authoritative; amounts are distributed to hit them exactly.
// Run: node generate_transactions.js > transactions.json

(function () {
  const txns = [];

  // ── RNG ────────────────────────────────────────────────────────────────────
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
  }
  const R = rng(31337);
  const ri = (lo, hi) => Math.floor(R() * (hi - lo + 1)) + lo;
  const pick = arr => arr[Math.floor(R() * arr.length)];
  const pad = n => String(n).padStart(2, '0');
  const daysIn = (y, m) => new Date(y, m, 0).getDate();
  const isoTs = (y, m, d, h, mi, s) =>
    `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}+05:30`;

  // ── Catalogs ───────────────────────────────────────────────────────────────
  const MERCHANTS = {
    Fashion:     ['Myntra','Myntra','Ajio','Nykaa Fashion','Max Fashion','H&M','Zara'],
    Travel:      ['MakeMyTrip','MakeMyTrip','GoIbibo','EaseMyTrip','OYO','Cleartrip'],
    Food:        ['Zomato','Zomato','Swiggy','BigBasket','Blinkit','Amazon Fresh'],
    Electronics: ['Boat','Noise','Croma','Croma','Reliance Digital','Samsung Store','OnePlus Store'],
    Health:      ['Apollo Pharmacy','Netmeds','1mg','HealthKart','PharmEasy'],
  };
  const SUBCATS = {
    Fashion:     ['Casual Wear','Ethnic Wear','Footwear','Accessories','Sports Wear'],
    Travel:      ['Domestic Flight','Hotel Booking','Bus Ticket','Holiday Package','Train Ticket'],
    Food:        ['Restaurant Delivery','Grocery','Quick Commerce','Meal Kit'],
    Electronics: ['Earphones','Smartwatch','Phone Accessories','Laptop','Home Appliances'],
    Health:      ['Prescription Medicine','Vitamins & Supplements','Personal Care','OTC Medicine'],
  };
  const DEVICES = ['mobile','mobile','mobile','mobile','desktop','tablet'];

  // Category weights for GMV distribution (Travel >> Fashion > Electronics > Health > Food)
  const CAT_W = { Fashion: 2.0, Travel: 6.0, Food: 0.9, Electronics: 4.5, Health: 1.3 };

  // ── Helpers ────────────────────────────────────────────────────────────────

  // Distribute targetGMV across a list of categories, returning integer amounts.
  // Uses a running-remainder approach so sum is ALWAYS exactly targetGMV.
  function distributeGMV(targetGMV, cats) {
    if (!cats.length) return [];
    if (cats.length === 1) return [targetGMV];
    const w = cats.map(c => CAT_W[c] || 1);
    const tw = w.reduce((a, b) => a + b, 0);
    const amts = w.map(wi => Math.max(50, Math.round(wi / tw * targetGMV)));
    // Apply ±15% noise; each element is clamped so remaining txns can each get ≥50
    let remaining = targetGMV;
    for (let i = 0; i < amts.length - 1; i++) {
      const slack = remaining - 50 * (amts.length - i - 1);
      const swing = Math.round(amts[i] * (R() * 0.30 - 0.15));
      amts[i] = Math.min(slack, Math.max(50, amts[i] + swing));
      remaining -= amts[i];
    }
    amts[amts.length - 1] = remaining; // exact; always ≥50 due to slack constraint
    return amts;
  }

  // Proportionally sample categories from a remaining budget object.
  function allocateCats(n, budget) {
    const result = [];
    const b = { ...budget };
    for (let i = 0; i < n; i++) {
      const cats = Object.keys(b).filter(c => b[c] > 0);
      if (!cats.length) break;
      const total = cats.reduce((s, c) => s + b[c], 0);
      let r = R() * total, cum = 0, chosen = cats[cats.length - 1];
      for (const c of cats) { cum += b[c]; if (r < cum) { chosen = c; break; } }
      result.push(chosen);
      b[chosen]--;
    }
    return result;
  }

  // Weighted payment mode picker
  function pmPick(modes) {
    let r = R(), cum = 0;
    for (const [m, w] of modes) { cum += w; if (r < cum) return m; }
    return modes[modes.length - 1][0];
  }

  // Build evenly-spaced coupon index set
  function couponSet(total, target) {
    const s = new Set();
    if (target <= 0) return s;
    for (let i = 0; i < target; i++)
      s.add(Math.round(i * (total - 1) / (target - 1)));
    return s;
  }

  // ── Core generator ─────────────────────────────────────────────────────────
  // monthPlan: [{y, m, n, gmv}]
  // catBudget: {Category: count, ...}   (must sum to total txns in monthPlan)
  // nCoupons:  integer count
  // returnIdxs: Set of 0-based sequence indices
  // payModes:  [[mode, weight], ...]
  // prefMerch: {Category: [merchant, ...]} overrides default list
  function generate(userId, monthPlan, catBudget, nCoupons, returnIdxs, payModes, prefMerch = {}) {
    const batch = [];
    const budget = { ...catBudget };

    for (const { y, m, n, gmv } of monthPlan) {
      const days = daysIn(y, m);
      const cats = allocateCats(n, budget);
      const amts = distributeGMV(gmv, cats);

      // Generate and sort timestamps within the month
      const stamps = Array.from({ length: n },
        () => isoTs(y, m, ri(1, days), ri(8, 23), ri(0, 59), ri(0, 59))
      ).sort();

      for (let i = 0; i < n; i++) {
        const cat = cats[i];
        batch.push({
          user_id:  userId,
          category: cat,
          merchant: pick(prefMerch[cat] || MERCHANTS[cat]),
          subcat:   pick(SUBCATS[cat]),
          amount:   amts[i],
          ts:       stamps[i],
          pm:       pmPick(payModes),
        });
      }
    }

    const cs = couponSet(batch.length, nCoupons);

    batch.forEach((t, idx) => {
      const isReturn  = returnIdxs.has(idx);
      const coupon    = cs.has(idx);
      txns.push({
        transaction_id:        'PLACEHOLDER',
        user_id:               t.user_id,
        merchant_name:         t.merchant,
        merchant_category:     t.category,
        subcategory:           t.subcat,
        transaction_amount:    t.amount,
        coupon_used:           coupon,
        coupon_discount_percent: coupon ? ri(10, 25) : 0,
        payment_mode:          t.pm,
        return_flag:           isReturn,
        refund_amount:         isReturn ? Math.round(t.amount * 0.9) : 0,
        timestamp:             t.ts,
        device_type:           pick(DEVICES),
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIYA (user_001) — 214 txns, Aug 2024 – Feb 2026
  // Pre-trend 7 months: GMV sums to 29,000
  // Last 12 months (Mar 2025 – Feb 2026): [3800,4100,4200,4400,4300,4600,4700,4900,5000,5200,5400,5600]
  // sum = 56,200 → total 85,200 ✓
  // ══════════════════════════════════════════════════════════════════════════
  generate(
    'user_001',
    [
      {y:2024,m:8, n:9,  gmv:4000}, {y:2024,m:9, n:9,  gmv:4000},
      {y:2024,m:10,n:10, gmv:4200}, {y:2024,m:11,n:10, gmv:4300},
      {y:2024,m:12,n:9,  gmv:4200}, {y:2025,m:1, n:10, gmv:4400},
      {y:2025,m:2, n:9,  gmv:3900},
      // ── last 12 months (gmv_trend_12m) ──
      {y:2025,m:3, n:12, gmv:3800}, {y:2025,m:4, n:12, gmv:4100},
      {y:2025,m:5, n:12, gmv:4200}, {y:2025,m:6, n:13, gmv:4400},
      {y:2025,m:7, n:12, gmv:4300}, {y:2025,m:8, n:13, gmv:4600},
      {y:2025,m:9, n:12, gmv:4700}, {y:2025,m:10,n:12, gmv:4900},
      {y:2025,m:11,n:12, gmv:5000}, {y:2025,m:12,n:13, gmv:5200},
      {y:2026,m:1, n:13, gmv:5400}, {y:2026,m:2, n:12, gmv:5600},
    ],
    { Fashion:75, Travel:54, Food:43, Electronics:32, Health:10 },
    118,  // deal_redemption_rate = 118/214 = 0.551
    new Set([12, 45, 90, 130]),  // return_rate = 4/214 = 0.019
    [['Credit Card',0.60],['UPI',0.30],['Debit Card',0.10]],
    {
      Fashion: ['Myntra','Myntra','Ajio','Nykaa Fashion','Max Fashion'],
      Travel:  ['MakeMyTrip','MakeMyTrip','GoIbibo','EaseMyTrip','Cleartrip'],
      Food:    ['Zomato','Zomato','Swiggy','Blinkit'],
    }
  );

  // ══════════════════════════════════════════════════════════════════════════
  // RAHUL (user_002) — 80 txns, Feb 2025 – Feb 2026
  // gmv_trend_12m = [2100,2300,2000,2200,2400,2100,2200,2500,2300,2100,2400,2200]
  // sum = 26,800 ✓
  // ══════════════════════════════════════════════════════════════════════════
  generate(
    'user_002',
    [
      {y:2025,m:2, n:6, gmv:2100}, {y:2025,m:3, n:7, gmv:2300},
      {y:2025,m:4, n:6, gmv:2000}, {y:2025,m:5, n:7, gmv:2200},
      {y:2025,m:6, n:7, gmv:2400}, {y:2025,m:7, n:6, gmv:2100},
      {y:2025,m:8, n:7, gmv:2200}, {y:2025,m:9, n:7, gmv:2500},
      {y:2025,m:10,n:6, gmv:2300}, {y:2025,m:11,n:6, gmv:2100},
      {y:2026,m:1, n:7, gmv:2400}, {y:2026,m:2, n:8, gmv:2200},
    ],
    { Food:40, Fashion:28, Health:12 },
    52,  // deal_redemption_rate = 52/80 = 0.650
    new Set([8, 22, 45, 68]),  // return_rate = 4/80 = 0.050
    [['UPI',0.70],['Debit Card',0.20],['COD',0.10]],
    {
      Food:    ['Zomato','Zomato','Swiggy','Blinkit'],
      Fashion: ['Myntra','Myntra','Ajio','Max Fashion'],
      Health:  ['Apollo Pharmacy','Netmeds','1mg','PharmEasy'],
    }
  );

  // ══════════════════════════════════════════════════════════════════════════
  // ANANYA (user_003) — 25 txns, Dec 2025 – Feb 2026 (3 active months)
  // gmv_trend_12m positions 9,10,11 = [1500, 3000, 4500]  sum = 9,000 ✓
  // ══════════════════════════════════════════════════════════════════════════
  generate(
    'user_003',
    [
      {y:2025,m:12,n:5,  gmv:1500},
      {y:2026,m:1, n:8,  gmv:3000},
      {y:2026,m:2, n:12, gmv:4500},
    ],
    { Travel:20, Food:5 },
    11,  // deal_redemption_rate = 11/25 = 0.440
    new Set(),  // return_rate = 0
    [['Credit Card',0.50],['UPI',0.50]],
    {
      Travel: ['MakeMyTrip','MakeMyTrip','EaseMyTrip','GoIbibo','Cleartrip'],
      Food:   ['Zomato','Swiggy'],
    }
  );

  // ══════════════════════════════════════════════════════════════════════════
  // VIKRAM (user_004) — 60 txns total, 14 active months
  //
  // PERIOD A: Early (Dec 2024 – Oct 2025, 45 txns)
  //   Pre-trend GMV: 2500+2000 = 4500
  //   Trend months Mar–Oct: 7200+6800+6000+5200+4500+3800+3000+2200 = 38700
  //   Period A total GMV: 43200
  //   Categories: Fashion 18, Electronics 14, Food 13
  //   Payment: CC27% UPI40% COD33%  (produces overall CC≈20% after period B)
  //   Returns: 7 out of 45 (keeps overall 7/60 = 11.7%)
  //   Coupons: 38 out of 45 (≈84%)
  //
  // PERIOD B: Recent (Nov 2025 – Feb 2026, 15 txns)
  //   Trend months Nov–Feb: 1800+1200+1000+1000 = 5000
  //   Categories: Food 13, Health 2
  //   Payment: COD60% UPI40%
  //   Returns: 0
  //   Coupons: 13 out of 15 (≈87%)
  //
  // Combined: 45+15=60 ✓  coupons=51 (85%) ✓  returns=7 (11.7%) ✓
  // Pre-trend + trend = 4500+43200 =   wait: 4500+38700+5000 = 48200 ✓
  // ══════════════════════════════════════════════════════════════════════════
  generate(
    'user_004',
    [
      {y:2024,m:12,n:5,  gmv:2500}, {y:2025,m:1, n:4,  gmv:2000},
      // ── gmv_trend_12m[0..7]: Mar – Oct 2025 ──
      {y:2025,m:3, n:6,  gmv:7200}, {y:2025,m:4, n:5,  gmv:6800},
      {y:2025,m:5, n:5,  gmv:6000}, {y:2025,m:6, n:4,  gmv:5200},
      {y:2025,m:7, n:4,  gmv:4500}, {y:2025,m:8, n:4,  gmv:3800},
      {y:2025,m:9, n:4,  gmv:3000}, {y:2025,m:10,n:4,  gmv:2200},
    ],
    { Fashion:18, Electronics:14, Food:13 },
    38,
    new Set([2, 5, 8, 13, 19, 4, 11]),  // 7 returns
    [['Credit Card',0.27],['UPI',0.40],['COD',0.33]],
    {
      Fashion:     ['Myntra','Myntra','Ajio','Max Fashion','H&M'],
      Electronics: ['Croma','Croma','Reliance Digital','Samsung Store'],
      Food:        ['Zomato','Swiggy'],
    }
  );

  generate(
    'user_004',
    [
      // ── gmv_trend_12m[8..11]: Nov 2025 – Feb 2026 ──
      {y:2025,m:11,n:4,  gmv:1800}, {y:2025,m:12,n:4,  gmv:1200},
      {y:2026,m:1, n:4,  gmv:1000}, {y:2026,m:2, n:3,  gmv:1000},
    ],
    { Food:13, Health:2 },
    13,
    new Set(),
    [['COD',0.60],['UPI',0.40]],
    {
      Food:   ['Zomato','Swiggy','Blinkit'],
      Health: ['Apollo Pharmacy','Netmeds','1mg'],
    }
  );

  // ══════════════════════════════════════════════════════════════════════════
  // GHOST (user_005) — 2 manual txns
  // Fraud signals: new account (<7 days), velocity spike (>₹20K in 48 hrs), 100% COD
  // ══════════════════════════════════════════════════════════════════════════
  txns.push({
    transaction_id:          'PLACEHOLDER',
    user_id:                 'user_005',
    merchant_name:           'Croma',
    merchant_category:       'Electronics',
    subcategory:             'Laptop',
    transaction_amount:      45000,
    coupon_used:             false,
    coupon_discount_percent: 0,
    payment_mode:            'COD',
    return_flag:             false,
    refund_amount:           0,
    timestamp:               '2026-02-23T02:47:00+05:30',
    device_type:             'mobile',
  });
  txns.push({
    transaction_id:          'PLACEHOLDER',
    user_id:                 'user_005',
    merchant_name:           'Reliance Digital',
    merchant_category:       'Electronics',
    subcategory:             'Smart TV',
    transaction_amount:      40000,
    coupon_used:             false,
    coupon_discount_percent: 0,
    payment_mode:            'COD',
    return_flag:             false,
    refund_amount:           0,
    timestamp:               '2026-02-25T14:22:00+05:30',
    device_type:             'mobile',
  });

  // ── Sort and assign sequential IDs ────────────────────────────────────────
  txns.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
  txns.forEach((t, i) => { t.transaction_id = 'txn_' + String(i + 1).padStart(5, '0'); });

  // ── Output ────────────────────────────────────────────────────────────────
  process.stdout.write(JSON.stringify(txns, null, 2));

  // ── Verification summary ──────────────────────────────────────────────────
  process.stderr.write('\n=== VERIFICATION ===\n');
  const s = {};
  for (const t of txns) {
    const u = t.user_id;
    if (!s[u]) s[u] = { count: 0, gmv: 0, coupons: 0, returns: 0 };
    s[u].count++;
    s[u].gmv += t.transaction_amount;
    if (t.coupon_used) s[u].coupons++;
    if (t.return_flag) s[u].returns++;
  }

  const expected = {
    user_001: { count:214, gmv:85200, coupon:0.55, ret:0.019 },
    user_002: { count:80,  gmv:26800, coupon:0.65, ret:0.050 },
    user_003: { count:25,  gmv:9000,  coupon:0.44, ret:0.000 },
    user_004: { count:60,  gmv:48200, coupon:0.85, ret:0.117 },
    user_005: { count:2,   gmv:85000, coupon:0.00, ret:0.000 },
  };

  for (const uid of Object.keys(expected).sort()) {
    const v = s[uid] || {};
    const e = expected[uid];
    const ok = c => c ? '✓' : '✗';
    process.stderr.write(
      `${uid}: txns=${v.count}${ok(v.count===e.count)}  ` +
      `gmv=₹${v.gmv}${ok(v.gmv===e.gmv)}  ` +
      `coupon=${(v.coupons/v.count).toFixed(3)}(want ${e.coupon})  ` +
      `return=${(v.returns/v.count).toFixed(3)}(want ${e.ret})\n`
    );
  }
  process.stderr.write(`Total txns: ${txns.length}\n`);
})();
