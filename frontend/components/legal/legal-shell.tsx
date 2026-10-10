import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  DRAFT_BANNER_ENABLED,
  DRAFT_BANNER_TEXT,
  LEGAL_LAST_UPDATED,
  LEGAL_ROUTES,
} from '@/lib/legal/legal-config';

interface LegalShellProps {
  readonly title: string;
  readonly children: ReactNode;
}

export function LegalShell({ title, children }: LegalShellProps) {
  return (
    <main className="mx-auto min-h-dvh max-w-prose bg-white px-4 py-12 text-gray-900 sm:px-6">
      <header className="mb-6">
        <Link href="/" className="text-primary-700 text-xl font-semibold">
          Kitcha
        </Link>
      </header>

      {DRAFT_BANNER_ENABLED && (
        <div
          role="note"
          className="mb-6 rounded-md bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800"
        >
          {DRAFT_BANNER_TEXT}
        </div>
      )}

      <h1 className="text-[28px] leading-tight font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-gray-600">Last updated: {LEGAL_LAST_UPDATED}</p>

      <div className="mt-8 space-y-8 text-base leading-relaxed">{children}</div>

      <footer className="mt-12 border-t border-gray-200 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-sm">
        <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2">
          <a href={LEGAL_ROUTES.privacy} className="underline">
            Privacy Policy
          </a>
          <a href={LEGAL_ROUTES.terms} className="underline">
            Terms of Use
          </a>
          <a href={LEGAL_ROUTES.support} className="underline">
            Support
          </a>
          <a href="/dashboard" className="underline">
            Back to Kitcha
          </a>
        </nav>
      </footer>
    </main>
  );
}

interface LegalSectionProps {
  readonly heading: string;
  readonly children: ReactNode;
}

export function LegalSection({ heading, children }: LegalSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{heading}</h2>
      {children}
    </section>
  );
}
