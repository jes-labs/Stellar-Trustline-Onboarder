/**
 * The activation deep-link contract. An exchange or broker builds a redirect URL with these
 * params; the activation page reads them. This is the client side of the standard, so the param
 * names are stable.
 */
export interface ActivationParams {
  /** Asset code, e.g. "EURC". Required. */
  asset: string;
  /** Pending amount to claim. */
  amount?: string;
  /** Name of the platform the user is withdrawing from. */
  platform?: string;
  /** Recipient account (G...). */
  destination?: string;
  /** Asset issuer account (G...). */
  issuer?: string;
  /** Claimable balance id, when the flow is a claim. */
  balanceId?: string;
  /** Where the page returns the user afterward. */
  returnUrl?: string;
  /** Broker logo URL for the top-bar slot. */
  logo?: string;
  /** Hex override for the brand color. */
  primary?: string;
}

// Maps a typed field to its query-string key. They match today, but keeping the indirection
// means a field can be renamed without changing the wire format.
const PARAM_KEYS: Record<keyof ActivationParams, string> = {
  asset: 'asset',
  amount: 'amount',
  platform: 'platform',
  destination: 'destination',
  issuer: 'issuer',
  balanceId: 'balanceId',
  returnUrl: 'returnUrl',
  logo: 'logo',
  primary: 'primary',
};

/**
 * Build the activation redirect URL. `baseUrl` is the absolute URL of the activation page, e.g.
 * `https://activate.example/withdraw`.
 */
export function buildActivationUrl(baseUrl: string, params: ActivationParams): string {
  const url = new URL(baseUrl);
  for (const key of Object.keys(PARAM_KEYS) as (keyof ActivationParams)[]) {
    const value = params[key];
    if (value !== undefined && value !== '') {
      url.searchParams.set(PARAM_KEYS[key], value);
    }
  }
  return url.toString();
}

/** Parse activation params from a query string, a full URL, or a `URLSearchParams`. */
export function parseActivationParams(input: string | URLSearchParams): ActivationParams {
  const sp = toSearchParams(input);
  const get = (key: keyof ActivationParams): string | undefined => {
    const value = sp.get(PARAM_KEYS[key]);
    return value === null || value === '' ? undefined : value;
  };
  return {
    asset: get('asset') ?? '',
    amount: get('amount'),
    platform: get('platform'),
    destination: get('destination'),
    issuer: get('issuer'),
    balanceId: get('balanceId'),
    returnUrl: get('returnUrl'),
    logo: get('logo'),
    primary: get('primary'),
  };
}

function toSearchParams(input: string | URLSearchParams): URLSearchParams {
  if (typeof input !== 'string') return input;
  const query = input.includes('?') ? input.slice(input.indexOf('?') + 1) : input;
  return new URLSearchParams(query);
}
