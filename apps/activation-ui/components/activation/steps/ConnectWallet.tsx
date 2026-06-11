import { memo } from 'react';
import type { WalletId } from '../../../lib/types';
import { WALLETS } from '../../../lib/wallets';
import { ChevronRightIcon, WalletGlyph } from '../icons';

export const ConnectWallet = memo(function ConnectWallet({
  asset,
  connectingId,
  onSelect,
  onNoWallet,
}: {
  asset: string;
  connectingId: WalletId | null;
  onSelect: (id: WalletId) => void;
  onNoWallet: () => void;
}) {
  const busy = connectingId !== null;
  return (
    <>
      <h1 className="mb-[6px] font-heading text-[22px] font-bold tracking-[-0.02em]">
        Choose your wallet
      </h1>
      <p className="mb-5 text-[14px] leading-[1.5] text-muted">
        Pick where you want to receive {asset}. You can change this later.
      </p>

      <div className="flex flex-col gap-[11px]">
        {WALLETS.map((w) => {
          const isConnecting = connectingId === w.id;
          return (
            <button
              key={w.id}
              type="button"
              disabled={busy}
              onClick={() => onSelect(w.id)}
              className="flex w-full items-center gap-[14px] rounded-[15px] border border-border bg-card p-[15px] text-left transition-colors hover:border-indigo hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo disabled:cursor-default aria-[busy=true]:cursor-wait"
              aria-busy={isConnecting}
            >
              <span
                className="grid h-[42px] w-[42px] flex-none place-items-center rounded-[12px]"
                style={{ background: w.bg, color: w.fg }}
              >
                <WalletGlyph icon={w.icon} />
              </span>
              <span className="flex-1">
                <span className="block text-[15px] font-semibold text-ink">{w.name}</span>
                <span className="mt-[1px] block text-[12.5px] text-muted">
                  {isConnecting ? 'Connecting…' : w.desc}
                </span>
              </span>
              <span className="text-muted">
                <ChevronRightIcon />
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onNoWallet}
        disabled={busy}
        className="mx-auto mt-[18px] block rounded-[6px] border-none bg-transparent text-[13px] font-medium text-muted underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
      >
        I do not have a wallet yet
      </button>
    </>
  );
});
