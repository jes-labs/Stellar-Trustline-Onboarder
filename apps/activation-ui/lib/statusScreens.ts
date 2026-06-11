import type { Screen } from './types';

export type StatusTone = 'indigo' | 'success' | 'error' | 'warning' | 'slate';
export type StatusIcon =
  | 'wallet'
  | 'spinner'
  | 'check'
  | 'alert'
  | 'shield'
  | 'block'
  | 'clock'
  | 'walletx';
export type StatusDetail = 'balance' | 'wallet' | 'none';

/** Action keys the flow maps to real handlers, kept separate from the copy that names them. */
export type StatusAction =
  | 'cancel'
  | 'returnToPlatform'
  | 'viewExplorer'
  | 'retry'
  | 'continueKyc'
  | 'doLater'
  | 'contactSupport'
  | 'backToStart'
  | 'getWallet'
  | 'haveWallet';

export interface StatusButton {
  label: string;
  action: StatusAction;
}

export interface StatusDescriptor {
  tone: StatusTone;
  icon: StatusIcon;
  title: string;
  body: string;
  detail: StatusDetail;
  /** Pulsing ring behind the badge (approve). */
  pulse?: boolean;
  /** Indeterminate bar across the top of the card (processing). */
  progress?: boolean;
  primary?: StatusButton;
  secondary?: StatusButton;
}

const STATUS_SCREENS: ReadonlySet<Screen> = new Set([
  'approve',
  'processing',
  'success',
  'failed',
  'kyc',
  'rejected',
  'expired',
  'no-wallet',
]);

export function isStatusScreen(screen: Screen): boolean {
  return STATUS_SCREENS.has(screen);
}

export interface StatusContext {
  asset: string;
  platform: string;
  walletName: string;
}

/** The copy and shape for a status screen. Returns null for the non-status (form) screens. */
export function statusDescriptor(screen: Screen, ctx: StatusContext): StatusDescriptor | null {
  const { asset, platform, walletName } = ctx;
  switch (screen) {
    case 'approve':
      return {
        tone: 'indigo',
        icon: 'wallet',
        title: 'Approve in your wallet',
        body: `Open ${walletName} and approve to continue. This is free and safe.`,
        detail: 'wallet',
        pulse: true,
        secondary: { label: 'Cancel', action: 'cancel' },
      };
    case 'processing':
      return {
        tone: 'indigo',
        icon: 'spinner',
        title: 'Setting things up',
        body: 'Submitting to the Stellar network. This only takes a few seconds.',
        detail: 'none',
        progress: true,
      };
    case 'success':
      return {
        tone: 'success',
        icon: 'check',
        title: `${asset} is ready`,
        body: 'Your asset is active and your withdrawal is on the way.',
        detail: 'balance',
        primary: { label: `Return to ${platform}`, action: 'returnToPlatform' },
        secondary: { label: 'View on explorer', action: 'viewExplorer' },
      };
    case 'failed':
      return {
        tone: 'error',
        icon: 'alert',
        title: 'Something went wrong',
        body: `We could not activate ${asset}. You were not charged. Please try again.`,
        detail: 'none',
        primary: { label: 'Try again', action: 'retry' },
        secondary: { label: 'Back to start', action: 'backToStart' },
      };
    case 'kyc':
      return {
        tone: 'warning',
        icon: 'shield',
        title: 'Verification needed',
        body: `${platform} needs to verify your identity before you can receive ${asset}.`,
        detail: 'none',
        primary: { label: 'Continue to verify', action: 'continueKyc' },
        secondary: { label: 'Do this later', action: 'doLater' },
      };
    case 'rejected':
      return {
        tone: 'error',
        icon: 'block',
        title: 'Activation not approved',
        body: `This request did not pass compliance checks. Contact ${platform} for help.`,
        detail: 'none',
        primary: { label: 'Contact support', action: 'contactSupport' },
      };
    case 'expired':
      return {
        tone: 'slate',
        icon: 'clock',
        title: 'This claim has expired',
        body: `The pending amount is no longer available. Start a new withdrawal from ${platform}.`,
        detail: 'none',
        primary: { label: `Return to ${platform}`, action: 'returnToPlatform' },
      };
    case 'no-wallet':
      return {
        tone: 'slate',
        icon: 'walletx',
        title: 'No wallet found',
        body: 'We could not find a Stellar wallet in this browser. Install one to continue.',
        detail: 'none',
        primary: { label: 'Get a wallet', action: 'getWallet' },
        secondary: { label: 'I already have one', action: 'haveWallet' },
      };
    default:
      return null;
  }
}
