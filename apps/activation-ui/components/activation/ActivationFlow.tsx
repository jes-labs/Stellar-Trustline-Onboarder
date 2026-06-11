'use client';

import { useMemo } from 'react';
import { HttpBackend } from '../../lib/backend';
import { useActivation } from '../../lib/machine';
import { isStatusScreen, statusDescriptor } from '../../lib/statusScreens';
import type { ActivationConfig } from '../../lib/types';
import { ActivationShell } from './ActivationShell';
import { BackButton } from './buttons';
import { ConnectWallet } from './steps/ConnectWallet';
import { Review } from './steps/Review';
import { SelectAsset } from './steps/SelectAsset';
import { StatusScreen } from './steps/StatusScreen';
import { Welcome } from './steps/Welcome';

export function ActivationFlow({ config }: { config: ActivationConfig }) {
  // One backend instance for the session; the flow talks only to this interface.
  const backend = useMemo(() => new HttpBackend(), []);
  const { state, actions } = useActivation(config, backend);

  // The asset code shown throughout: the user's chosen asset once picked, the URL default before.
  const assetCode = state.asset?.code ?? config.assetCode;
  // The connected wallet's name, set by the kit on connect; a neutral fallback before then.
  const walletName = state.walletName || 'your wallet';

  const descriptor = useMemo(
    () =>
      isStatusScreen(state.screen)
        ? statusDescriptor(state.screen, {
            asset: assetCode,
            platform: config.platform,
            walletName,
          })
        : null,
    [state.screen, assetCode, config.platform, walletName],
  );

  const showBack =
    state.screen === 'selectAsset' || state.screen === 'connect' || state.screen === 'review';

  return (
    <ActivationShell brokerLogoUrl={config.brokerLogoUrl} brandColor={config.primaryColor}>
      {showBack && <BackButton onClick={actions.back} />}

      {state.screen === 'welcome' && (
        <Welcome
          asset={state.asset?.code ?? null}
          platform={config.platform}
          onGetStarted={actions.getStarted}
        />
      )}

      {state.screen === 'selectAsset' && <SelectAsset onChoose={actions.chooseAsset} />}

      {state.screen === 'connect' && (
        <ConnectWallet
          asset={assetCode}
          connecting={state.connecting}
          error={state.connectError}
          onConnect={actions.connect}
        />
      )}

      {state.screen === 'review' && (
        <Review
          asset={assetCode}
          amount={config.amount}
          walletName={walletName}
          address={state.address}
          onActivate={actions.activate}
        />
      )}

      {descriptor && (
        <StatusScreen
          descriptor={descriptor}
          asset={assetCode}
          amount={config.amount}
          walletName={walletName}
          address={state.address}
          onAction={actions.runStatusAction}
        />
      )}
    </ActivationShell>
  );
}
