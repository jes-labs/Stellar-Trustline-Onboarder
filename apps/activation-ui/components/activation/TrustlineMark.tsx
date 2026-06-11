/**
 * Placeholder brand mark: an indigo tile holding a small "trustline" motif, a filled node
 * rising along a curve into a hollow ring. Swap for a real logo when one exists. Sizes are
 * computed, so this stays inline-styled rather than fighting Tailwind for arbitrary dimensions.
 */
export function TrustlineMark({ size = 18 }: { size?: number }) {
  const inner = Math.round(size * 0.64);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: 'var(--color-indigo)',
        boxShadow: '0 6px 14px -8px var(--color-indigo)',
        flex: '0 0 auto',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <svg width={inner} height={inner} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 18C6 11 11 6.5 18 6.5" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
        <circle cx="6" cy="18" r="1.9" fill="#fff" />
        <circle cx="18" cy="6.5" r="2.4" fill="none" stroke="#fff" strokeWidth={2.2} />
      </svg>
    </div>
  );
}
