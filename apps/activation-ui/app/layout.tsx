import type { ReactNode } from 'react';

export const metadata = {
  title: 'Welcome to Stellar',
  description: 'Activate your Stellar asset — no trustline step, no XLM required.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#0d1117',
          color: '#e6edf3',
        }}
      >
        {children}
      </body>
    </html>
  );
}
