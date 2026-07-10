import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PRODUCT_NAME, PRODUCT_TAGLINE } from '@/lib/brand';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: `${PRODUCT_NAME} — ${PRODUCT_TAGLINE}`,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description:
    'Give AI agents governed access to your data in an afternoon. Signed, scoped, revocable ' +
    'access grants with a full audit trail — instead of API keys and download links.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
