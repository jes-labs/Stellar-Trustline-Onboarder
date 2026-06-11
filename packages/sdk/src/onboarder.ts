import {
  type BuiltTransaction,
  buildAuthorize,
  buildClaimRegulated,
  buildClaimUnregulated,
  buildCreateClaimableBalance,
  type NetworkConfig,
  parseTransaction,
  submit,
} from '@trustline-onboarder/core';
import { requestApproval, resolveApprovalServer } from './approval';
import { OnboardingError } from './errors';
import { detectTrustline, isRegulated, loadSource } from './horizon';
import { explorerTxUrl, networkConfig } from './network';
import { buildRedirectUrl } from './redirect';
import { signWithSponsor, sponsorPublicKey } from './sponsor';
import type {
  DetectResult,
  OnboardingPlan,
  OnboardRequest,
  SendRequest,
  SettledActivation,
  StartOnboardingParams,
  StartOnboardingResult,
  TrustlineOnboarderConfig,
} from './types';

/**
 * The adopter-facing entry point. One instance serves both personas:
 *
 *   - A **wallet** (recipient) calls {@link detect} → {@link buildOnboardingTx} → (user signs) →
 *     {@link submit} to put a user into an asset with a sponsored trustline, no XLM, no manual step.
 *   - A **broker** (sender) calls {@link startOnboarding} to hand a withdrawing user to the hosted
 *     page, or {@link buildSend} to push a claimable balance the user collects later.
 *
 * The SDK never holds keys: building returns XDR for each party to sign. The sponsor is always
 * bring-your-own (see {@link TrustlineOnboarderConfig.sponsor}); there is no remote signing
 * fallback. Issuer signatures for regulated assets come from that issuer's SEP-8 approval server.
 */
export class TrustlineOnboarder {
  private readonly net: NetworkConfig;

  constructor(private readonly config: TrustlineOnboarderConfig) {
    this.net = networkConfig(config.network, config.horizonUrl);
  }

  /** Does this account already hold (and is it authorized for) the asset? */
  detect(params: { account: string; asset: OnboardRequest['asset'] }): Promise<DetectResult> {
    return detectTrustline(this.net.horizonUrl, params.account, params.asset);
  }

  /** True once the account holds an authorized trustline — call after submitting to confirm. */
  async verifyActivation(params: {
    account: string;
    asset: OnboardRequest['asset'];
  }): Promise<boolean> {
    const result = await this.detect(params);
    return result.hasTrustline && result.authorized;
  }

  /**
   * Build the recipient-side activation transaction: a sponsored trustline, plus a claim when a
   * `balanceId` is given. For a regulated asset the issuer authorization is obtained from the
   * approval server here (it may revise the transaction), so the returned XDR is what the user
   * must sign. Throws `no-sponsor` when no sponsor is configured.
   */
  async buildOnboardingTx(req: OnboardRequest): Promise<OnboardingPlan> {
    const sponsor = sponsorPublicKey(this.config.sponsor);
    const source = await loadSource(this.net.horizonUrl, req.account);
    const regulated = await isRegulated(this.net.horizonUrl, req.asset.issuer);
    const mechanism = req.mechanism ?? (req.balanceId ? 'claimable' : 'authorize');

    let built: BuiltTransaction;
    if (mechanism === 'claimable') {
      if (!req.balanceId) {
        throw new OnboardingError('failed', 'the claimable mechanism requires a balanceId');
      }
      const params = {
        asset: req.asset,
        recipient: req.account,
        sponsor,
        balanceId: req.balanceId,
        limit: req.limit,
      };
      built = regulated
        ? buildClaimRegulated(params, source, this.net.networkPassphrase)
        : buildClaimUnregulated(params, source, this.net.networkPassphrase);
    } else {
      built = buildAuthorize(
        {
          asset: req.asset,
          profile: regulated ? 'regulated' : 'unregulated',
          user: req.account,
          sponsor,
          limit: req.limit,
        },
        source,
        this.net.networkPassphrase,
      );
    }

    // Regulated assets carry an issuer authorization op only the issuer can sign.
    let tx = built.xdr;
    if (built.issuerAuthOpIndex !== undefined) {
      const approvalUrl = await resolveApprovalServer(
        this.net.horizonUrl,
        req.asset,
        this.config.approvalServerUrl,
      );
      tx = await requestApproval(approvalUrl, tx, this.net.networkPassphrase);
    }

    return {
      tx,
      requiredSigners: built.requiredSigners,
      mechanism,
      issuerAuthOpIndex: built.issuerAuthOpIndex,
      sponsor,
      network: this.net.networkPassphrase,
    };
  }

  /**
   * Add the sponsor's signature to a user-signed transaction and submit it to Horizon. The
   * sponsor is signed locally (bring-your-own); the SDK contacts no remote signer.
   */
  async submit(signedXdr: string): Promise<SettledActivation> {
    const tx = parseTransaction(signedXdr, this.net.networkPassphrase);
    const sponsored = await signWithSponsor(this.config.sponsor, tx, this.net.networkPassphrase);
    const result = await submit(this.net.horizonUrl, sponsored);
    return { hash: result.hash, explorerUrl: explorerTxUrl(this.config.network, result.hash) };
  }

  /**
   * Broker entry: either hand the user to the hosted activation page (redirect) or, when a
   * sponsor is configured and direct mode is wanted, build the transaction in-process. Defaults
   * to direct when a sponsor exists, otherwise redirect.
   */
  async startOnboarding(params: StartOnboardingParams): Promise<StartOnboardingResult> {
    const canDirect = Boolean(this.config.sponsor);
    const prefer = params.prefer ?? (canDirect ? 'direct' : 'redirect');

    if (prefer === 'redirect' || !canDirect) {
      if (!this.config.serviceUrl) {
        throw new OnboardingError('failed', 'redirect mode requires a serviceUrl');
      }
      return { mode: 'redirect', url: buildRedirectUrl(this.config.serviceUrl, params) };
    }

    const plan = await this.buildOnboardingTx({
      asset: params.asset,
      account: params.destination,
      balanceId: params.balanceId,
    });
    return { mode: 'direct', plan };
  }

  /**
   * Broker entry: build a claimable balance addressed to a recipient who has no trustline yet
   * ("send now, claim later"). The broker signs it with the sender's key and submits; the user
   * claims it later through the recipient flow. Returns the unsigned {@link BuiltTransaction}.
   */
  async buildSend(req: SendRequest): Promise<BuiltTransaction> {
    const source = await loadSource(this.net.horizonUrl, req.sender);
    return buildCreateClaimableBalance(
      {
        asset: req.asset,
        amount: req.amount,
        recipient: req.recipient,
        sender: req.sender,
        reclaimAfterSeconds: req.reclaimAfterSeconds,
      },
      source,
      this.net.networkPassphrase,
    );
  }
}
