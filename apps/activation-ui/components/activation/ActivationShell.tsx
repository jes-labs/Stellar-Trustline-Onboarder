import type { CSSProperties, ReactNode } from 'react';
import { ImageIcon } from './icons';
import { TrustlineMark } from './TrustlineMark';

/** Legal/help links shown in the footer. A deployment supplies the URLs. */
export interface LegalLinks {
  help?: string;
  privacy?: string;
  terms?: string;
}

function BrokerSlot({ logoUrl }: { logoUrl?: string }) {
  if (logoUrl) {
    // Plain img: broker logos are arbitrary remote URLs, not part of our asset pipeline, so
    // next/image (which needs configured remote hosts) does not fit here.
    // biome-ignore lint/performance/noImgElement: remote broker logo, not a pipeline asset.
    return <img src={logoUrl} alt="" className="h-[34px] w-auto object-contain" />;
  }
  return (
    <div
      className="inline-flex h-[34px] items-center gap-2 whitespace-nowrap rounded-[9px] border-[1.5px] border-dashed border-border bg-white/55 px-[13px]"
      title="Broker logo slot: a partner sets their own logo here"
    >
      <ImageIcon className="text-muted" />
      <span className="text-[12px] font-semibold text-muted">Broker logo</span>
    </div>
  );
}

// Reads as a link when the deployment provides a URL, otherwise as plain text, so the footer
// never ships dead "#" anchors.
function FooterItem({ label, href }: { label: string; href?: string }) {
  const className = 'text-muted no-underline transition-colors hover:text-ink';
  return href ? (
    <a href={href} className={className}>
      {label}
    </a>
  ) : (
    <span className="text-muted">{label}</span>
  );
}

/**
 * The page frame shared by every step: a slim top bar (broker logo slot + "secured by"
 * lockup), the centered card that holds the current step, and the footer. One fluid layout
 * that reflows from desktop to phone, no device chrome.
 */
export function ActivationShell({
  brokerLogoUrl,
  brandColor,
  legal,
  children,
}: {
  brokerLogoUrl?: string;
  brandColor?: string;
  legal?: LegalLinks;
  children: ReactNode;
}) {
  // A broker re-themes by overriding the primary token here; every indigo utility follows.
  const themeStyle = brandColor ? ({ '--color-indigo': brandColor } as CSSProperties) : undefined;
  return (
    <div className="flex min-h-screen flex-col bg-surface" style={themeStyle}>
      <header className="flex flex-none flex-wrap items-center justify-between gap-3 px-[22px] py-4">
        <BrokerSlot logoUrl={brokerLogoUrl} />
        <div className="flex items-center gap-[7px]">
          <TrustlineMark size={18} />
          <span className="text-[12px] text-muted">
            Secured by <span className="font-heading font-semibold text-ink">Trustline</span>
          </span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-[18px] pt-2 pb-[44px]">
        <div className="w-full max-w-[452px] rounded-card border border-border bg-card px-[30px] py-8 shadow-card">
          {children}
        </div>
      </main>

      <footer className="flex flex-none flex-wrap items-center justify-between gap-x-[22px] gap-y-[14px] border-t border-border px-[22px] py-4">
        <div className="flex items-center gap-[9px] text-[12px] text-muted">
          <span>© 2026 Trustline</span>
          <span className="h-[3px] w-[3px] rounded-full bg-border" />
          <span>Sponsored on the Stellar network</span>
        </div>
        <nav className="flex items-center gap-5 text-[12.5px]">
          <FooterItem label="Help" href={legal?.help} />
          <FooterItem label="Privacy" href={legal?.privacy} />
          <FooterItem label="Terms" href={legal?.terms} />
        </nav>
      </footer>
    </div>
  );
}
