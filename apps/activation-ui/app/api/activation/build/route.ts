import {
  type AssetRef,
  type BuiltTransaction,
  buildAuthorize,
  buildClaimRegulated,
  buildClaimUnregulated,
  horizon,
  loadAccount,
  parseTransaction,
} from '@trustline-onboarder/core';
import { NextResponse } from 'next/server';
import { authEnabled, bearer, verifySession } from '../../../../lib/auth';
import { guard } from '../../../../lib/guard';
import {
  APPROVAL_SERVER_URL,
  HORIZON_URL,
  IS_TESTNET,
  NETWORK_PASSPHRASE,
  sponsorKeypair,
  sponsorPublicKey,
} from '../../../../lib/serverStellar';
import type { ActivationConfig, SelectedAsset } from '../../../../lib/types';

export const runtime = 'nodejs';

interface BuildBody {
  config?: ActivationConfig;
  asset?: SelectedAsset | null;
  address?: string;
}

function fail(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ code, message }, { status });
}

/** Whether the issuer enforces AUTH_REQUIRED — authoritative, read from the account's flags. */
async function isRegulated(issuer: string, hint: boolean): Promise<boolean> {
  try {
    const account = await horizon(HORIZON_URL).loadAccount(issuer);
    return account.flags?.auth_required === true;
  } catch {
    // If the issuer lookup fails, trust the hint the picker already derived from Horizon.
    return hint;
  }
}

/** Load the recipient account; on testnet, Friendbot-fund it first if it does not exist yet. */
async function loadRecipient(address: string) {
  try {
    return await loadAccount(HORIZON_URL, address);
  } catch {
    if (!IS_TESTNET) throw new Error('account not found');
    const res = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`);
    if (!res.ok) throw new Error('could not fund account');
    return await loadAccount(HORIZON_URL, address);
  }
}

/**
 * Build the activation transaction, run the issuer approval for regulated assets, and sign as the
 * sponsor. Returns the XDR the connected wallet still needs to sign with the user's key.
 *
 *   - no claimable balance → Mechanism A (`buildAuthorize`): a sponsored trustline
 *   - a claimable balance   → Mechanism C (`buildClaim*`): sponsored trustline + claim
 *
 * Regulated (AUTH_REQUIRED) assets need the issuer's signature. We can only obtain it for an asset
 * whose approval server we run (`APPROVAL_SERVER_URL`); for any other regulated asset we cannot
 * self-authorize, so the user is routed to verification (`kyc`).
 *
 * When SEP-10 is configured (WEB_AUTH_JWT_SECRET), the request must carry a valid session token;
 * that token is forwarded to the approval server, which also requires it.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const blocked = guard(request, 10);
  if (blocked) return blocked;

  let body: BuildBody;
  try {
    body = (await request.json()) as BuildBody;
  } catch {
    return fail('failed', 'invalid request body', 400);
  }

  const config = body.config;
  if (!config || !body.address) return fail('failed', 'missing config or address', 400);

  // SEP-10 session required (when auth is configured). The same token is forwarded to the
  // issuer's approval server below.
  const token = bearer(request.headers.get('authorization'));
  if (authEnabled() && !(await verifySession(token))) {
    return fail('failed', 'unauthorized', 401);
  }

  // QA override: preview KYC / compliance edge screens without touching the chain.
  if (config.simulate === 'kyc') return NextResponse.json({ code: 'kyc' }, { status: 422 });
  if (config.simulate === 'rejected')
    return NextResponse.json({ code: 'rejected' }, { status: 422 });

  const code = body.asset?.code ?? config.assetCode;
  const issuer = body.asset?.issuer ?? config.issuer;
  if (!issuer) return fail('failed', 'missing asset issuer', 400);

  const asset: AssetRef = { code, issuer };
  const recipient = body.address;
  const sponsor = sponsorPublicKey();

  let built: BuiltTransaction;
  try {
    const recipientAccount = await loadRecipient(recipient);
    const regulated = await isRegulated(issuer, body.asset?.regulated ?? false);

    if (config.balanceId) {
      built = regulated
        ? buildClaimRegulated(
            { asset, recipient, sponsor, balanceId: config.balanceId },
            recipientAccount,
            NETWORK_PASSPHRASE,
          )
        : buildClaimUnregulated(
            { asset, recipient, sponsor, balanceId: config.balanceId },
            recipientAccount,
            NETWORK_PASSPHRASE,
          );
    } else {
      built = buildAuthorize(
        {
          asset,
          profile: regulated ? 'regulated' : 'unregulated',
          user: recipient,
          sponsor,
        },
        recipientAccount,
        NETWORK_PASSPHRASE,
      );
    }

    // Regulated assets carry an issuer authorization op that only the issuer can sign.
    let xdr = built.xdr;
    if (built.issuerAuthOpIndex !== undefined) {
      if (!APPROVAL_SERVER_URL) {
        // Not an asset we can authorize — the user must verify with the issuer/platform.
        return NextResponse.json({ code: 'kyc' }, { status: 422 });
      }
      xdr = await runApproval(xdr, token);
    }

    // Sign as the sponsor (who pays the reserve). The wallet adds the user's signature next.
    const tx = parseTransaction(xdr, NETWORK_PASSPHRASE);
    tx.sign(sponsorKeypair());
    return NextResponse.json({ xdr: tx.toXDR(), networkPassphrase: NETWORK_PASSPHRASE });
  } catch (err) {
    if (err instanceof ApprovalRedirect) {
      return NextResponse.json({ code: err.code }, { status: 422 });
    }
    const message = err instanceof Error ? err.message : 'build failed';
    return fail('failed', message, 502);
  }
}

/**
 * Hand a regulated transaction to the SEP-8 approval server for the issuer's signature, forwarding
 * the caller's SEP-10 session token. Throws an {@link ApprovalRedirect} carrying the screen code
 * for non-success statuses.
 */
async function runApproval(xdr: string, token?: string): Promise<string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${APPROVAL_SERVER_URL}/tx-approve`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tx: xdr }),
  });
  const result = (await res.json()) as { status?: string; tx?: string };
  if ((result.status === 'success' || result.status === 'revised') && result.tx) {
    return result.tx;
  }
  if (result.status === 'rejected') throw new ApprovalRedirect('rejected');
  throw new ApprovalRedirect('kyc');
}

/** Internal signal that the approval server returned a non-success status mapped to a screen. */
class ApprovalRedirect extends Error {
  constructor(readonly code: 'kyc' | 'rejected') {
    super(code);
  }
}
