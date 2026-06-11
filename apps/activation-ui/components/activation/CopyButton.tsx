'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CopyIcon } from './icons';

/**
 * Copies the full value to the clipboard and confirms for ~1.6s. State is local, so copying
 * never re-renders the surrounding flow.
 */
export function CopyButton({ value, label = 'Copy address' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(() => {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }, [value]);

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className="flex flex-none items-center gap-[5px] rounded-[9px] border border-border bg-card px-[10px] py-[7px] text-[11.5px] font-semibold text-muted transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
    >
      <CopyIcon />
      {copied && <span className="text-success">Copied</span>}
    </button>
  );
}
