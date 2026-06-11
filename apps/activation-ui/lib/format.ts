/**
 * Shorten a Stellar address to "GDUKMG…LEXAB" for display. The full value is what we copy to
 * the clipboard; this is only what the eye sees. Short inputs are returned unchanged.
 */
export function truncateAddress(address: string, edge = 6): string {
  if (address.length <= edge * 2 + 1) return address;
  return `${address.slice(0, edge)}…${address.slice(-edge)}`;
}
