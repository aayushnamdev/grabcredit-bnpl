import { NextRequest, NextResponse } from 'next/server';
import { callConfirmEmiPlan } from '@/lib/backend';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, purchase_amount, selected_months, merchant_name } = body;

    if (!user_id || !purchase_amount || !selected_months) {
      return NextResponse.json(
        { error: 'user_id, purchase_amount, and selected_months are required' },
        { status: 400 }
      );
    }

    const result = await callConfirmEmiPlan(user_id, purchase_amount, selected_months, merchant_name);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
