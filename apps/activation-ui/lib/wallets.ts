import type { WalletId } from './types';

export type WalletIconName = 'wallet' | 'phone' | 'plus';

export interface WalletDef {
  id: WalletId;
  name: string;
  desc: string;
  icon: WalletIconName;
  /** Icon tile background and foreground (CSS color values, so brand tokens can flow through). */
  bg: string;
  fg: string;
}

export const WALLETS: readonly WalletDef[] = [
  {
    id: 'freighter',
    name: 'Freighter',
    desc: 'Browser extension',
    icon: 'wallet',
    bg: 'var(--color-tint-indigo)',
    fg: 'var(--color-indigo)',
  },
  {
    id: 'mobile',
    name: 'Mobile wallet',
    desc: 'Connect by deep link',
    icon: 'phone',
    bg: 'var(--color-tint-teal)',
    fg: '#0891b2',
  },
  {
    id: 'other',
    name: 'Other wallet',
    desc: 'Connect another way',
    icon: 'plus',
    bg: 'var(--color-tint-slate)',
    fg: 'var(--color-muted)',
  },
] as const;

const WALLET_BY_ID = new Map(WALLETS.map((w) => [w.id, w]));

export function walletById(id: WalletId): WalletDef {
  const wallet = WALLET_BY_ID.get(id);
  if (!wallet) throw new Error(`unknown wallet id: ${id}`);
  return wallet;
}
