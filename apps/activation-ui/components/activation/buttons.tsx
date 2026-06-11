import type { ReactNode } from 'react';
import { ChevronLeftIcon } from './icons';

/** Full-width primary action. Hover darkens via brightness so a re-themed indigo still works. */
export function PrimaryButton({
  children,
  onClick,
  className = '',
}: {
  children: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-btn bg-indigo p-[15px] font-sans text-[15.5px] font-semibold text-white shadow-btn transition-[filter] hover:[filter:brightness(0.93)] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-indigo ${className}`}
    >
      {children}
    </button>
  );
}

/** Quiet, full-width secondary action used beneath a primary one on status screens. */
export function SecondaryButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 w-full rounded-[12px] bg-transparent p-3 font-sans text-[14px] font-semibold text-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
    >
      {children}
    </button>
  );
}

/** The card's Back control, shown on the Connect and Review steps. */
export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-[18px] inline-flex items-center gap-[6px] rounded-[10px] border border-border bg-card py-[7px] pr-[12px] pl-[9px] font-sans text-[13px] font-semibold text-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
    >
      <ChevronLeftIcon />
      Back
    </button>
  );
}
