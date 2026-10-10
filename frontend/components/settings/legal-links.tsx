import { ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { LEGAL_ROUTES } from '@/lib/legal/legal-config';

const LINKS = [
  { label: 'Privacy Policy', href: LEGAL_ROUTES.privacy },
  { label: 'Terms of Use', href: LEGAL_ROUTES.terms },
  { label: 'Support', href: LEGAL_ROUTES.support },
] as const;

export function LegalLinks() {
  return (
    <Card className="p-4 sm:p-6">
      <h2 className="text-xl font-semibold text-gray-900">Legal and support</h2>
      <ul className="mt-2 divide-y divide-gray-200">
        {LINKS.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              className="flex min-h-11 items-center justify-between text-base text-gray-900 hover:text-primary-700"
            >
              <span>{link.label}</span>
              <ChevronRight className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}
