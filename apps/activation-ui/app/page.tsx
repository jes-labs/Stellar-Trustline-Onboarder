import { redirect } from 'next/navigation';
import type { RawParams } from '../lib/config';

// The activation page lives at /withdraw. Forward any redirect params from the bare root.
export default async function Home({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') qs.set(key, value);
  }
  const query = qs.toString();
  redirect(query ? `/withdraw?${query}` : '/withdraw');
}
