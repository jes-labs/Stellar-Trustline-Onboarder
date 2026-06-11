import { memo, type ReactNode } from 'react';
import type { StatusIcon } from '../../lib/statusScreens';
import type { WalletIconName } from '../../lib/wallets';

export interface GlyphProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

// Shared stroke-icon frame. Icons are decorative; meaning is carried by adjacent text.
function Svg({
  size = 24,
  strokeWidth = 1.7,
  className,
  children,
}: GlyphProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export const StarIcon = memo(function StarIcon({
  size = 15,
  strokeWidth = 2.2,
  className,
}: GlyphProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className}>
      <path d="M12 2l2.4 6.6L21 9l-5.4 4 2 6.8L12 16l-5.6 3.8 2-6.8L3 9l6.6-.4z" />
    </Svg>
  );
});

export const CheckIcon = memo(function CheckIcon({
  size = 16,
  strokeWidth = 2.4,
  className,
}: GlyphProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className}>
      <path d="M20 6L9 17l-5-5" />
    </Svg>
  );
});

export const WalletIcon = memo(function WalletIcon({
  size = 22,
  strokeWidth = 1.7,
  className,
}: GlyphProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className}>
      <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3" />
      <path d="M21 10v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7" />
      <circle cx="17" cy="13" r="1.3" fill="currentColor" stroke="none" />
    </Svg>
  );
});

export const PhoneIcon = memo(function PhoneIcon({
  size = 22,
  strokeWidth = 1.7,
  className,
}: GlyphProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className}>
      <path d="M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M10.5 18h3" />
    </Svg>
  );
});

export const PlusIcon = memo(function PlusIcon({
  size = 22,
  strokeWidth = 1.7,
  className,
}: GlyphProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className}>
      <path d="M5 8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" />
      <path d="M12 9.5v5" />
      <path d="M9.5 12h5" />
    </Svg>
  );
});

export const ChevronRightIcon = memo(function ChevronRightIcon({
  size = 19,
  strokeWidth = 2,
  className,
}: GlyphProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className}>
      <path d="M9 18l6-6-6-6" />
    </Svg>
  );
});

export const ChevronLeftIcon = memo(function ChevronLeftIcon({
  size = 15,
  strokeWidth = 2,
  className,
}: GlyphProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className}>
      <path d="M15 18l-6-6 6-6" />
    </Svg>
  );
});

export const BoltIcon = memo(function BoltIcon({
  size = 18,
  strokeWidth = 2,
  className,
}: GlyphProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className}>
      <path d="M13 2L3 14h7l-1 8 10-12h-7z" />
    </Svg>
  );
});

export const ArrowDownIcon = memo(function ArrowDownIcon({
  size = 18,
  strokeWidth = 2,
  className,
}: GlyphProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className}>
      <path d="M12 5v14" />
      <path d="M19 12l-7 7-7-7" />
    </Svg>
  );
});

export const CopyIcon = memo(function CopyIcon({
  size = 14,
  strokeWidth = 1.9,
  className,
}: GlyphProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </Svg>
  );
});

export const ImageIcon = memo(function ImageIcon({
  size = 15,
  strokeWidth = 1.8,
  className,
}: GlyphProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="M21 16l-5-5L5 20" />
    </Svg>
  );
});

const AlertIcon = memo(function AlertIcon({ size = 38, strokeWidth = 2, className }: GlyphProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4.5" />
      <path d="M12 17h.01" />
    </Svg>
  );
});

const ShieldIcon = memo(function ShieldIcon({
  size = 38,
  strokeWidth = 1.9,
  className,
}: GlyphProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className}>
      <path d="M12 3 5 6v5c0 4.6 3.1 7.7 7 9 3.9-1.3 7-4.4 7-9V6l-7-3z" />
      <path d="M9 12l2 2 4-4" />
    </Svg>
  );
});

const BlockIcon = memo(function BlockIcon({ size = 38, strokeWidth = 2, className }: GlyphProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M6 6l12 12" />
    </Svg>
  );
});

const ClockIcon = memo(function ClockIcon({ size = 38, strokeWidth = 2, className }: GlyphProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4.2l2.8 2" />
    </Svg>
  );
});

const WalletXIcon = memo(function WalletXIcon({
  size = 38,
  strokeWidth = 1.9,
  className,
}: GlyphProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className}>
      <path d="M3 7a2 2 0 0 1 2-2h10" />
      <path d="M19 9v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7" />
      <path d="M15.5 8.5l5 5" />
      <path d="M20.5 8.5l-5 5" />
    </Svg>
  );
});

// The processing spinner: a faint full ring with a bright quarter-arc rotating over it.
const SpinnerIcon = memo(function SpinnerIcon() {
  return (
    <svg width={42} height={42} viewBox="0 0 24 24" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        opacity={0.18}
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        style={{ transformOrigin: '12px 12px', animation: 'tl-spin 0.9s linear infinite' }}
      />
    </svg>
  );
});

/** Render a wallet's icon by name. */
export function WalletGlyph({ icon, size }: { icon: WalletIconName; size?: number }) {
  if (icon === 'phone') return <PhoneIcon size={size} />;
  if (icon === 'plus') return <PlusIcon size={size} />;
  return <WalletIcon size={size} />;
}

/** Render a status badge glyph by name, at the size the badge expects. */
export function StatusGlyph({ name }: { name: StatusIcon }) {
  switch (name) {
    case 'wallet':
      return <WalletIcon size={22} />;
    case 'spinner':
      return <SpinnerIcon />;
    case 'check':
      return <CheckIcon size={40} />;
    case 'alert':
      return <AlertIcon />;
    case 'shield':
      return <ShieldIcon />;
    case 'block':
      return <BlockIcon />;
    case 'clock':
      return <ClockIcon />;
    case 'walletx':
      return <WalletXIcon />;
  }
}
