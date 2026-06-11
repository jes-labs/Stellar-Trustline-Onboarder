import { memo } from 'react';
import { PrimaryButton } from '../buttons';
import { WalletIcon } from '../icons';

export const ConnectWallet = memo(function ConnectWallet({
  asset,
  connecting,
  error,
  onConnect,
}: {
  asset: string;
  connecting: boolean;
  error: string | null;
  onConnect: () => void;
}) {
  return (
    <>
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-5 grid h-[68px] w-[68px] place-items-center rounded-full bg-tint-indigo text-indigo">
          <WalletIcon size={30} />
        </div>
        <h1 className="mb-[8px] font-heading text-[22px] font-bold tracking-[-0.02em]">
          Connect your wallet
        </h1>
        <p className="max-w-[320px] text-[14px] leading-[1.55] text-muted">
          Connect a Stellar wallet to receive {asset}. We support Freighter, xBull, Albedo, Rabet,
          and Lobstr.
        </p>
      </div>

      <PrimaryButton onClick={onConnect}>
        {connecting ? 'Connecting…' : 'Connect wallet'}
      </PrimaryButton>

      {error && <p className="mt-[13px] text-center text-[12.5px] text-error">{error}</p>}
    </>
  );
});
