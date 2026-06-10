import {
  type Account,
  Asset,
  AuthClawbackEnabledFlag,
  type AuthFlag,
  AuthRequiredFlag,
  AuthRevocableFlag,
  BASE_FEE,
  type Horizon,
  type Keypair,
  Operation,
  type Transaction,
  TransactionBuilder,
  type xdr,
} from '@stellar/stellar-sdk';
import {
  type BuiltTransaction,
  horizon as makeHorizon,
  TESTNET,
  toTransaction,
} from '@trustline-onboarder/core';

export const NETWORK = TESTNET.networkPassphrase;
export const HORIZON_URL = TESTNET.horizonUrl;
export const server: Horizon.Server = makeHorizon(HORIZON_URL);

let step = 0;
export function logStep(message: string): void {
  step += 1;
  console.log(`\n\x1b[36m[${step}]\x1b[0m ${message}`);
}
export function logInfo(message: string): void {
  console.log(`    ${message}`);
}
export function logOk(message: string): void {
  console.log(`    \x1b[32m✓\x1b[0m ${message}`);
}

/** Fund an account on testnet via Friendbot (no secrets required). */
export async function friendbot(publicKey: string): Promise<void> {
  const res = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
  if (!res.ok) {
    throw new Error(`Friendbot failed for ${publicKey}: ${res.status} ${await res.text()}`);
  }
}

/** Load an account as an SDK source (fee/sequence). */
export async function load(publicKey: string): Promise<Account> {
  return (await server.loadAccount(publicKey)) as unknown as Account;
}

/** Build, sign, and submit a transaction from explicit operations (used for test scaffolding). */
export async function submitOps(
  sourceKp: Keypair,
  operations: xdr.Operation[],
  extraSigners: Keypair[] = [],
): Promise<Horizon.HorizonApi.SubmitTransactionResponse> {
  const source = await load(sourceKp.publicKey());
  const builder = new TransactionBuilder(source, {
    fee: String(Number(BASE_FEE) * 100),
    networkPassphrase: NETWORK,
  });
  for (const op of operations) builder.addOperation(op);
  const tx = builder.setTimeout(180).build();
  tx.sign(sourceKp, ...extraSigners);
  return server.submitTransaction(tx);
}

/** Sign a {@link BuiltTransaction} with the given keypairs and submit it. */
export async function signAndSubmit(
  built: BuiltTransaction,
  signers: Keypair[],
): Promise<Horizon.HorizonApi.SubmitTransactionResponse> {
  const tx: Transaction = toTransaction(built);
  tx.sign(...signers);
  return server.submitTransaction(tx);
}

/** The native XLM balance of an account. */
export async function xlmBalance(publicKey: string): Promise<number> {
  const acct = await server.loadAccount(publicKey);
  const native = acct.balances.find((b) => b.asset_type === 'native');
  return native ? Number(native.balance) : 0;
}

/** The balance line for a given asset, including its sponsor and authorization state. */
export async function assetBalance(
  publicKey: string,
  asset: Asset,
): Promise<{ balance: string; sponsor?: string; authorized?: boolean } | undefined> {
  const acct = await server.loadAccount(publicKey);
  const line = acct.balances.find(
    (b) =>
      'asset_code' in b &&
      b.asset_code === asset.getCode() &&
      'asset_issuer' in b &&
      b.asset_issuer === asset.getIssuer(),
  );
  if (!line) return undefined;
  return {
    balance: line.balance,
    sponsor: 'sponsor' in line ? line.sponsor : undefined,
    authorized: 'is_authorized' in line ? line.is_authorized : undefined,
  };
}

/**
 * Issue a classic asset for the demo: the distributor establishes a trustline and the issuer
 * pays it `amount`. Returns the SDK Asset. Plain operations — this is test scaffolding, not part
 * of the standard.
 */
export async function issueAsset(
  issuerKp: Keypair,
  distributorKp: Keypair,
  code: string,
  amount: string,
): Promise<Asset> {
  const asset = new Asset(code, issuerKp.publicKey());
  await submitOps(distributorKp, [Operation.changeTrust({ asset })]);
  await submitOps(issuerKp, [
    Operation.payment({ destination: distributorKp.publicKey(), asset, amount }),
  ]);
  return asset;
}

/** Enable AUTH_REQUIRED, AUTH_REVOCABLE, and clawback on the issuer (regulated profile). */
export async function setRegulatedFlags(issuerKp: Keypair): Promise<void> {
  const combined = (AuthRequiredFlag | AuthRevocableFlag | AuthClawbackEnabledFlag) as AuthFlag;
  await submitOps(issuerKp, [Operation.setOptions({ setFlags: combined })]);
}

/** Authorize a trustline the issuer must approve (used when distributing a regulated asset). */
export async function authorizeTrustline(
  issuerKp: Keypair,
  trustor: string,
  asset: Asset,
): Promise<void> {
  await submitOps(issuerKp, [
    Operation.setTrustLineFlags({ trustor, asset, flags: { authorized: true } }),
  ]);
}
