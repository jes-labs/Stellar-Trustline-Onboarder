import { memo } from 'react';
import { truncateAddress } from '../../../lib/format';
import type { StatusAction, StatusDescriptor, StatusTone } from '../../../lib/statusScreens';
import { PrimaryButton, SecondaryButton } from '../buttons';
import { StatusGlyph } from '../icons';

const TONES: Record<StatusTone, { bg: string; color: string }> = {
  indigo: { bg: 'var(--color-tint-indigo)', color: 'var(--color-indigo)' },
  success: { bg: 'var(--color-tint-success)', color: 'var(--color-success)' },
  error: { bg: 'var(--color-tint-error)', color: 'var(--color-error)' },
  warning: { bg: 'var(--color-tint-warning)', color: 'var(--color-warning)' },
  slate: { bg: 'var(--color-tint-slate)', color: 'var(--color-muted)' },
};

export const StatusScreen = memo(function StatusScreen({
  descriptor,
  asset,
  amount,
  walletName,
  address,
  onAction,
}: {
  descriptor: StatusDescriptor;
  asset: string;
  amount: string;
  walletName: string;
  address: string;
  onAction: (action: StatusAction) => void;
}) {
  const tone = TONES[descriptor.tone];
  const { primary, secondary } = descriptor;

  return (
    <>
      {descriptor.progress && (
        <div className="relative mb-[26px] h-[3px] overflow-hidden rounded-[3px] bg-surface">
          <div className="absolute top-0 left-0 h-full w-[28%] rounded-[3px] bg-indigo [animation:tl-bar_1.3s_ease-in-out_infinite]" />
        </div>
      )}

      <div className="flex flex-col items-center pt-3 text-center">
        <div className="relative mb-6 grid h-[92px] w-[92px] place-items-center">
          {descriptor.pulse && (
            <div className="absolute inset-0 rounded-full bg-indigo [animation:tl-pulse_1.7s_ease-out_infinite]" />
          )}
          <div
            className="relative grid h-[92px] w-[92px] place-items-center rounded-full"
            style={{ background: tone.bg, color: tone.color }}
          >
            <StatusGlyph name={descriptor.icon} />
          </div>
        </div>

        <h1 className="mb-[10px] font-heading text-[23px] leading-[1.2] font-bold tracking-[-0.02em]">
          {descriptor.title}
        </h1>
        <p className="max-w-[320px] text-[14.5px] leading-[1.55] text-muted">{descriptor.body}</p>

        {descriptor.detail === 'balance' && (
          <div className="mt-6 w-full rounded-panel border border-border bg-surface p-5">
            <div className="mb-2 text-[11.5px] font-semibold tracking-[0.06em] text-muted uppercase">
              Your balance
            </div>
            <div className="flex items-baseline justify-center gap-2">
              <span className="font-mono text-[32px] font-semibold tracking-[-0.02em]">
                {amount}
              </span>
              <span className="font-mono text-[17px] font-semibold text-muted">{asset}</span>
            </div>
          </div>
        )}

        {descriptor.detail === 'wallet' && (
          <div className="mt-[22px] inline-flex items-center gap-[10px] rounded-full border border-border px-[15px] py-[9px]">
            <span className="h-2 w-2 rounded-full bg-indigo" />
            <span className="text-[12.5px] font-semibold">{walletName}</span>
            <span className="font-mono text-[12px] text-muted">{truncateAddress(address)}</span>
          </div>
        )}
      </div>

      {primary && (
        <PrimaryButton className="mt-7" onClick={() => onAction(primary.action)}>
          {primary.label}
        </PrimaryButton>
      )}
      {secondary && (
        <SecondaryButton onClick={() => onAction(secondary.action)}>
          {secondary.label}
        </SecondaryButton>
      )}
    </>
  );
});
