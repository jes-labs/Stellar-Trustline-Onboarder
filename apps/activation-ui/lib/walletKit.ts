'use client';

import { ActivationError } from './backend';

/**
 * The browser-side wallet seam, built on Stellar Wallets Kit (v2, a static singleton).
 *
 * Connection goes through the kit's own modal: the user picks from the available wallets
 * (Freighter, xBull, Albedo, Rabet, Lobstr) in one step — no custom selection screen, no
 * WalletConnect/mobile path. Everything is dynamically imported on first use because the kit
 * pulls in heavy, browser-only dependencies (lit web components) that must never reach the
 * server bundle.
 */

// Network passphrases, inlined so this client module needs no `@trustline-onboarder/core` import.
// `NEXT_PUBLIC_STELLAR_NETWORK` selects public vs testnet; defaults to testnet.
const IS_PUBLIC = process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'public';
const NETWORK_PASSPHRASE = IS_PUBLIC
  ? 'Public Global Stellar Network ; September 2015'
  : 'Test SDF Network ; September 2015';

interface KitContext {
  kit: typeof import('@creit.tech/stellar-wallets-kit').StellarWalletsKit;
}

let kitPromise: Promise<KitContext> | null = null;

function browserOnly(): void {
  if (typeof window === 'undefined') {
    throw new ActivationError('failed', 'wallet connection is only available in the browser');
  }
}

async function initKit(): Promise<KitContext> {
  const { StellarWalletsKit, Networks } = await import('@creit.tech/stellar-wallets-kit');
  const network = IS_PUBLIC ? Networks.PUBLIC : Networks.TESTNET;

  const [freighter, xbull, albedo, rabet, lobstr] = await Promise.all([
    import('@creit.tech/stellar-wallets-kit/modules/freighter'),
    import('@creit.tech/stellar-wallets-kit/modules/xbull'),
    import('@creit.tech/stellar-wallets-kit/modules/albedo'),
    import('@creit.tech/stellar-wallets-kit/modules/rabet'),
    import('@creit.tech/stellar-wallets-kit/modules/lobstr'),
  ]);

  StellarWalletsKit.init({
    network,
    modules: [
      new freighter.FreighterModule(),
      new xbull.xBullModule(),
      new albedo.AlbedoModule(),
      new rabet.RabetModule(),
      new lobstr.LobstrModule(),
    ],
  });
  return { kit: StellarWalletsKit };
}

function loadKit(): Promise<KitContext> {
  browserOnly();
  if (!kitPromise) kitPromise = initKit();
  return kitPromise;
}

function wrap(err: unknown): ActivationError {
  if (err instanceof ActivationError) return err;
  const message = err instanceof Error ? err.message : 'wallet connection failed';
  return new ActivationError('failed', message);
}

/**
 * Open the kit's connect modal and return the chosen wallet's address and display name. The
 * selected wallet stays active in the kit's singleton, so {@link signTransactionXdr} later signs
 * with the same one.
 */
export async function connectWallet(): Promise<{ address: string; walletName: string }> {
  const { kit } = await loadKit();
  try {
    const { address } = await kit.authModal();
    const walletName = kit.selectedModule?.productName ?? 'Wallet';
    return { address, walletName };
  } catch (err) {
    throw wrap(err);
  }
}

/** Sign an unsigned/partially-signed transaction XDR with the connected wallet; return the new XDR. */
export async function signTransactionXdr(xdr: string, address: string): Promise<string> {
  const { kit } = await loadKit();
  try {
    const { signedTxXdr } = await kit.signTransaction(xdr, {
      networkPassphrase: NETWORK_PASSPHRASE,
      address,
    });
    return signedTxXdr;
  } catch (err) {
    throw wrap(err);
  }
}
