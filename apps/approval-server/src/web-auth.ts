import { Keypair, WebAuth } from '@stellar/stellar-sdk';
import { jwtVerify, SignJWT } from 'jose';

export interface WebAuthConfig {
  /** Secret of the account that signs SEP-10 challenges (the issuer here). */
  serverSecret: string;
  network: string;
  homeDomain: string;
  webAuthDomain: string;
  /** Symmetric secret for signing session tokens. Shared with any other verifier. */
  jwtSecret: string;
  tokenTtlSeconds?: number;
}

const CHALLENGE_TIMEOUT_SECONDS = 300;

/**
 * SEP-10 web authentication. Issues a challenge transaction the client signs to prove control of
 * a Stellar account, verifies the signed challenge, and exchanges it for a short-lived JWT
 * session token. The token is required on the endpoints that apply the issuer signature.
 */
export class WebAuthService {
  private readonly serverKeypair: Keypair;
  private readonly jwtKey: Uint8Array;
  private readonly ttl: number;

  constructor(private readonly config: WebAuthConfig) {
    this.serverKeypair = Keypair.fromSecret(config.serverSecret);
    this.jwtKey = new TextEncoder().encode(config.jwtSecret);
    this.ttl = config.tokenTtlSeconds ?? 900;
  }

  serverAccount(): string {
    return this.serverKeypair.publicKey();
  }

  /** Build a challenge transaction for the client account to sign. */
  buildChallenge(account: string): string {
    return WebAuth.buildChallengeTx(
      this.serverKeypair,
      account,
      this.config.homeDomain,
      CHALLENGE_TIMEOUT_SECONDS,
      this.config.network,
      this.config.webAuthDomain,
    );
  }

  /**
   * Verify a signed challenge and, if the client signed it, issue a session token bound to that
   * account. Throws if the challenge is invalid or not signed by the client.
   */
  async verifyChallenge(signedChallengeXdr: string): Promise<string> {
    const { clientAccountID } = WebAuth.readChallengeTx(
      signedChallengeXdr,
      this.serverKeypair.publicKey(),
      this.config.network,
      [this.config.homeDomain],
      this.config.webAuthDomain,
    );
    const signers = WebAuth.verifyChallengeTxSigners(
      signedChallengeXdr,
      this.serverKeypair.publicKey(),
      this.config.network,
      [clientAccountID],
      [this.config.homeDomain],
      this.config.webAuthDomain,
    );
    if (!signers.includes(clientAccountID)) {
      throw new Error('challenge was not signed by the client account');
    }
    return this.issueToken(clientAccountID);
  }

  /** Issue a session token for an account (also used to mint tokens in tests). */
  async issueToken(account: string): Promise<string> {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return new SignJWT({ sub: account })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(nowSeconds)
      .setExpirationTime(nowSeconds + this.ttl)
      .sign(this.jwtKey);
  }

  /** Verify a session token and return the authenticated account, or null if invalid. */
  async verifyToken(token: string): Promise<string | null> {
    try {
      const { payload } = await jwtVerify(token, this.jwtKey, { algorithms: ['HS256'] });
      return typeof payload.sub === 'string' ? payload.sub : null;
    } catch {
      return null;
    }
  }
}

/** Extract a bearer token from an Authorization header. */
export function bearerToken(header: string | undefined): string | undefined {
  if (!header?.startsWith('Bearer ')) return undefined;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : undefined;
}
