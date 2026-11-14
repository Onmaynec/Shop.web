import { NextResponse } from 'next/server';
import { clearSession } from '../../../../lib/auth';
import { requireSameOrigin } from '../../../../lib/http-security';

export async function POST(request: Request) {
  const denied = requireSameOrigin(request);
  if (denied) return denied;
  await clearSession();
  return NextResponse.json({ok:true}, {headers:{'Cache-Control':'no-store'}});
}
