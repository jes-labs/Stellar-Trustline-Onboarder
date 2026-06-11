import { ActivationFlow } from '../../components/activation/ActivationFlow';
import { parseConfig, type RawParams } from '../../lib/config';

export default async function WithdrawPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const config = parseConfig(await searchParams);
  return <ActivationFlow config={config} />;
}
