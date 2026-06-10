import { Asset, Networks } from '@stellar/stellar-sdk';
import type { AssetRef } from './types';

/** Network configuration: where to submit and which passphrase to sign against. */
export interface NetworkConfig {
  horizonUrl: string;
  networkPassphrase: string;
}

/** Stellar testnet — the only network this reference implementation targets today. */
export const TESTNET: NetworkConfig = {
  horizonUrl: 'https://horizon-testnet.stellar.org',
  networkPassphrase: Networks.TESTNET,
};

/** Stellar public network (mainnet). Used only for the controlled pilot in a later phase. */
export const PUBLIC: NetworkConfig = {
  horizonUrl: 'https://horizon.stellar.org',
  networkPassphrase: Networks.PUBLIC,
};

/** Convert an {@link AssetRef} into an SDK {@link Asset}. */
export function toAsset(ref: AssetRef): Asset {
  return new Asset(ref.code, ref.issuer);
}
