import { memo } from 'react';
import { PrimaryButton } from '../buttons';
import { CheckIcon, StarIcon } from '../icons';

const ASSURANCES = ['No XLM needed to start', 'No fees to pay, ever', 'Fully sponsored for you'];

export const Welcome = memo(function Welcome({
  asset,
  platform,
  onGetStarted,
}: {
  /** The asset code when fixed by the URL; null when the user has yet to pick one. */
  asset: string | null;
  platform: string;
  onGetStarted: () => void;
}) {
  return (
    <>
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-5 h-20 w-20">
          <div className="absolute inset-0 grid place-items-center rounded-full bg-indigo shadow-asset">
            <span className="font-mono text-[19px] font-semibold tracking-[-0.02em] text-white">
              {asset ?? <StarIcon size={26} strokeWidth={2} />}
            </span>
          </div>
          <div className="absolute -right-[2px] -bottom-[2px] grid h-[29px] w-[29px] place-items-center rounded-full border border-border bg-card text-indigo">
            <StarIcon />
          </div>
        </div>

        <span className="mb-[15px] whitespace-nowrap rounded-full bg-tint-indigo px-3 py-[5px] text-[12.5px] font-semibold text-indigo">
          Stellar asset
        </span>
        <h1 className="mb-[10px] text-balance font-heading text-[24px] leading-[1.2] font-bold tracking-[-0.02em]">
          {asset ? `Activate ${asset} to receive your withdrawal` : 'Activate your Stellar asset'}
        </h1>
        <p className="mb-[22px] max-w-[330px] text-[14.5px] leading-[1.55] text-muted">
          {asset
            ? `One tap and your ${asset} arrives in seconds. We have set this up so you pay nothing.`
            : 'Set up your wallet to receive a Stellar asset in seconds. We have set this up so you pay nothing.'}
        </p>
      </div>

      <ul className="mb-6 list-none rounded-panel border border-border bg-surface px-4 py-1">
        {ASSURANCES.map((text, i) => (
          <li
            key={text}
            className={`flex items-center gap-[13px] py-3 ${i < ASSURANCES.length - 1 ? 'border-b border-border' : ''}`}
          >
            <span className="grid h-7 w-7 flex-none place-items-center rounded-[9px] bg-tint-success text-success">
              <CheckIcon />
            </span>
            <span className="text-[14px] font-medium">{text}</span>
          </li>
        ))}
      </ul>

      <PrimaryButton onClick={onGetStarted}>Get started</PrimaryButton>
      <p className="mt-[13px] text-center text-[12.5px] text-muted">
        Withdrawing from <span className="font-semibold text-ink">{platform}</span>
      </p>
    </>
  );
});
