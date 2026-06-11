import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** Proxy a SEP-10 challenge request to the issuer's approval server. */
export async function GET(request: Request): Promise<NextResponse> {
  const account = new URL(request.url).searchParams.get('account');
  if (!account) return NextResponse.json({ error: 'missing_account' }, { status: 400 });

  const approvalServerUrl = process.env.APPROVAL_SERVER_URL;
  if (!approvalServerUrl) return NextResponse.json({ error: 'auth_unavailable' }, { status: 503 });

  const res = await fetch(
    `${approvalServerUrl.replace(/\/$/, '')}/auth?account=${encodeURIComponent(account)}`,
  );
  return NextResponse.json(await res.json(), { status: res.status });
}
