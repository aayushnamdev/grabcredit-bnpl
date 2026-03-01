import { NextResponse } from 'next/server';
import { callGetPlatformAverages } from '@/lib/backend';

export async function GET() {
  try {
    const result = callGetPlatformAverages();
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
