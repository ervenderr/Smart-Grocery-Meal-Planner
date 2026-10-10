import type { Metadata } from 'next';
import { LegalSection, LegalShell } from '@/components/legal/legal-shell';
import { resolveSupportContact } from '@/lib/legal/legal-config';

export const metadata: Metadata = {
  title: 'Support | Kitcha',
  description: 'Get help with Kitcha: contact us and read answers to common questions.',
  robots: { index: true, follow: true },
};

const FAQ: ReadonlyArray<{ readonly q: string; readonly a: string }> = [
  {
    q: 'How do I delete my account?',
    a: 'Go to Settings > Data > Delete account. You will be asked for your password.',
  },
  {
    q: 'How do I turn off AI features?',
    a: 'Go to Settings > Privacy > AI features and switch them off.',
  },
  {
    q: 'How do I reset my password?',
    a: 'Go to Settings > Password, or contact support using the address above.',
  },
  {
    q: 'How do I report an AI suggestion?',
    a: 'Tap Report suggestion under any AI result.',
  },
];

export default function SupportPage() {
  const contact = resolveSupportContact(process.env.NEXT_PUBLIC_SUPPORT_EMAIL);

  return (
    <LegalShell title="Support">
      <LegalSection heading="Contact us">
        {contact.kind === 'email' ? (
          <p>
            Email us at{' '}
            <a href={contact.href} className="underline">
              {contact.email}
            </a>
            .
          </p>
        ) : (
          <p>Contact email not configured.</p>
        )}
      </LegalSection>

      <LegalSection heading="Frequently asked questions">
        <dl className="space-y-4">
          {FAQ.map((item) => (
            <div key={item.q}>
              <dt className="font-semibold">{item.q}</dt>
              <dd className="text-gray-700">{item.a}</dd>
            </div>
          ))}
        </dl>
      </LegalSection>
    </LegalShell>
  );
}
