import type { ActivationConfig } from './types';

/** Raw query params as Next.js hands them to a server component. */
export type RawParams = Record<string, string | string[] | undefined>;

const DEFAULTS = {
  assetCode: 'USDC',
  amount: '250.00',
  platform: 'your exchange',
} as const;

/** A non-functional stand-in address used until a wallet is connected. */
export const DEMO_ADDRESS = 'GDUKMGUGDZQK6YHYAJ5Z6AY2G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEXAB';

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const trimmed = v?.trim();
  return trimmed ? trimmed : undefined;
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const SIMULATE_VALUES = new Set(['failed', 'kyc', 'rejected', 'expired', 'no-wallet']);

/**
 * Turn redirect query params into a validated {@link ActivationConfig}. Unknown or malformed
 * values fall back to defaults rather than throwing, because this page is the last thing
 * standing between a user and a stuck withdrawal.
 */
export function parseConfig(params: RawParams): ActivationConfig {
  const primaryColor = first(params.primary);
  const simulate = first(params.simulate);

  return {
    assetCode: (first(params.asset) ?? DEFAULTS.assetCode).toUpperCase(),
    amount: first(params.amount) ?? DEFAULTS.amount,
    platform: first(params.platform) ?? DEFAULTS.platform,
    destination: first(params.destination),
    issuer: first(params.issuer),
    balanceId: first(params.balanceId),
    returnUrl: first(params.returnUrl),
    brokerLogoUrl: first(params.logo),
    primaryColor: primaryColor && HEX_COLOR.test(primaryColor) ? primaryColor : undefined,
    simulate:
      simulate && SIMULATE_VALUES.has(simulate)
        ? (simulate as ActivationConfig['simulate'])
        : undefined,
  };
}
