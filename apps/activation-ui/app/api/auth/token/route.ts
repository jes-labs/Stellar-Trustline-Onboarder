import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** Proxy a signed SEP-10 challenge to the approval server and return the session token. */
export async function POST(request: Request): Promise<NextResponse> {
  const approvalServerUrl = process.env.APPROVAL_SERVER_URL;
  if (!approvalServerUrl) return NextResponse.json({ error: 'auth_unavailable' }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const res = await fetch(`${approvalServerUrl.replace(/\/$/, '')}/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
