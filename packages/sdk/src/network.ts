import { type NetworkConfig, PUBLIC, TESTNET } from '@trustline-onboarder/core';
import type { NetworkName } from './types';

/** Resolve the Horizon URL + passphrase for a network, with an optional Horizon override. */
export function networkConfig(name: NetworkName, horizonUrl?: string): NetworkConfig {
  const base = name === 'public' ? PUBLIC : TESTNET;
  return horizonUrl ? { ...base, horizonUrl } : base;
}

/** The stellar.expert transaction URL for a given network. */
export function explorerTxUrl(name: NetworkName, hash: string): string {
  const segment = name === 'public' ? 'public' : 'testnet';
  return `https://stellar.expert/explorer/${segment}/tx/${hash}`;
}
