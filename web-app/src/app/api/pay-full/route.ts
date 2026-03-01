import { NextRequest, NextResponse } from 'next/server';
import { callPayFull } from '@/lib/backend';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, purchase_amount, merchant_name } = body;

    if (!user_id || !purchase_amount) {
      return NextResponse.json({ error: 'user_id and purchase_amount are required' }, { status: 400 });
    }

    const result = await callPayFull(user_id, purchase_amount, merchant_name);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
