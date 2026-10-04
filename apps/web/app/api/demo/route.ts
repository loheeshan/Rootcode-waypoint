import { NextResponse } from 'next/server';
import { demoConfig } from '../../../lib/demo';

/** Read at request time, so the same build shows the card only when the container runs the demo. */
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(demoConfig(), { headers: { 'Cache-Control': 'no-store' } });
}
