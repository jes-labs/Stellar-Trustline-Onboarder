'use client';

import { useMemo } from 'react';
import { HttpBackend } from '../../lib/backend';
import { useActivation } from '../../lib/machine';
import { isStatusScreen, statusDescriptor } from '../../lib/statusScreens';
import type { ActivationConfig } from '../../lib/types';
import { walletById } from '../../lib/wallets';
import { ActivationShell } from './ActivationShell';
import { BackButton } from './buttons';
import { ConnectWallet } from './steps/ConnectWallet';
import { Review } from './steps/Review';
import { StatusScreen } from './steps/StatusScreen';
import { Welcome } from './steps/Welcome';

export function ActivationFlow({ config }: { config: ActivationConfig }) {
  // One backend instance for the session; the flow talks only to this interface.
  const backend = useMemo(() => new HttpBackend(), []);
  const { state, actions } = useActivation(config, backend);

  const wallet = walletById(state.walletId ?? 'freighter');

  const descriptor = useMemo(
    () =>
      isStatusScreen(state.screen)
        ? statusDescriptor(state.screen, {
            asset: config.assetCode,
            platform: config.platform,
            walletName: wallet.name,
          })
        : null,
    [state.screen, config.assetCode, config.platform, wallet.name],
  );

  const showBack = state.screen === 'connect' || state.screen === 'review';

  return (
    <ActivationShell brokerLogoUrl={config.brokerLogoUrl} brandColor={config.primaryColor}>
      {showBack && <BackButton onClick={actions.back} />}

      {state.screen === 'welcome' && (
        <Welcome
          asset={config.assetCode}
          platform={config.platform}
          onGetStarted={actions.getStarted}
        />
      )}

      {state.screen === 'connect' && (
        <ConnectWallet
          asset={config.assetCode}
          connectingId={state.connecting ? state.walletId : null}
          onSelect={actions.selectWallet}
          onNoWallet={actions.noWallet}
        />
      )}

      {state.screen === 'review' && (
        <Review
          asset={config.assetCode}
          amount={config.amount}
          wallet={wallet}
          address={state.address}
          onActivate={actions.activate}
        />
      )}

      {descriptor && (
        <StatusScreen
          descriptor={descriptor}
          asset={config.assetCode}
          amount={config.amount}
          walletName={wallet.name}
          address={state.address}
          onAction={actions.runStatusAction}
        />
      )}
    </ActivationShell>
  );
}
