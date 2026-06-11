'use client';

import { useState } from 'react';
import { truncateAddress } from '../../../lib/format';
import { PrimaryButton } from '../buttons';
import { CopyButton } from '../CopyButton';
import { ArrowDownIcon, BoltIcon, WalletIcon } from '../icons';

export function Review({
  asset,
  amount,
  walletName,
  address,
  onActivate,
}: {
  asset: string;
  amount: string;
  walletName: string;
  address: string;
  onActivate: () => void;
}) {
  const [showTip, setShowTip] = useState(false);
  const hasClaim = amount.trim().length > 0;

  return (
    <>
      <h1 className="mb-[6px] font-heading text-[22px] font-bold tracking-[-0.02em]">
        Review and confirm
      </h1>
      <p className="mb-[18px] text-[14px] leading-[1.5] text-muted">
        Here is exactly what happens when you tap Activate.
      </p>

      <div className="overflow-hidden rounded-panel border border-border bg-surface">
        <div
          className={`flex items-start gap-[13px] p-[15px] ${hasClaim ? 'border-b border-border' : ''}`}
        >
          <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-tint-indigo text-indigo">
            <BoltIcon />
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-[7px]">
              <span className="text-[14.5px] font-semibold">Activate {asset}</span>
              <button
                type="button"
                onClick={() => setShowTip((v) => !v)}
                aria-label="What does activate mean"
                aria-expanded={showTip}
                className="grid h-[18px] w-[18px] place-items-center rounded-full border border-border bg-card p-0 text-[11px] leading-none font-bold text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
              >
                i
              </button>
            </div>
            <div className="mt-[3px] text-[12.5px] leading-[1.45] text-muted">
              Get your wallet ready to hold {asset}.
            </div>
            {showTip && (
              <div className="mt-[10px] rounded-[11px] bg-ink px-[13px] py-[11px] text-[12px] leading-[1.5] text-[#e2e8f0]">
                In technical terms this creates a{' '}
                <span className="font-mono text-white">trustline</span>. It is free and sponsored,
                so it costs you nothing.
              </div>
            )}
          </div>
          <span className="flex-none rounded-[7px] bg-tint-success px-[9px] py-[4px] text-[11.5px] font-semibold text-success">
            Free
          </span>
        </div>

        {hasClaim && (
          <div className="flex items-start gap-[13px] p-[15px]">
            <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-tint-success text-success">
              <ArrowDownIcon />
            </span>
            <div className="flex-1">
              <div className="text-[14.5px] font-semibold">Claim your pending {asset}</div>
              <div className="mt-[3px] text-[12.5px] text-muted">
                Sent to your wallet right away.
              </div>
            </div>
            <span className="flex-none font-mono text-[14px] font-semibold text-ink">{amount}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-1 pt-[13px] pb-[2px]">
        <span className="text-[13.5px] text-muted">Network fee</span>
        <span className="text-[13.5px] font-semibold text-success">Sponsored · $0.00</span>
      </div>

      <div className="mt-3 mb-[22px] flex items-center gap-[11px] rounded-[14px] border border-border px-[14px] py-3">
        <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-tint-indigo text-indigo">
          <WalletIcon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold">{walletName}</div>
          <div className="mt-[1px] font-mono text-[12px] text-muted">
            {truncateAddress(address)}
          </div>
        </div>
        <CopyButton value={address} />
      </div>

      <PrimaryButton onClick={onActivate}>Activate {asset}</PrimaryButton>
    </>
  );
}
