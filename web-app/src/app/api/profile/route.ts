import { NextRequest, NextResponse } from 'next/server';
import { callGetProfile } from '@/lib/backend';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('user_id');
  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    const result = callGetProfile(userId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
}
