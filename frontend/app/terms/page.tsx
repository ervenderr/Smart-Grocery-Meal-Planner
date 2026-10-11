import type { Metadata } from 'next';
import { LegalSection, LegalShell } from '@/components/legal/legal-shell';
import { resolveSupportContact } from '@/lib/legal/legal-config';

export const metadata: Metadata = {
  title: 'Terms of Use | Kumaun',
  description: 'The terms that apply when you use Kumaun, including AI-generated content.',
  robots: { index: true, follow: true },
};

const LINK = 'underline';

export default function TermsPage() {
  const contact = resolveSupportContact(process.env.NEXT_PUBLIC_SUPPORT_EMAIL);

  return (
    <LegalShell title="Terms of Use">
      <LegalSection heading="Acceptance">
        <p>By creating an account or using Kumaun you agree to these terms.</p>
      </LegalSection>

      <LegalSection heading="Your account">
        <p>
          You are responsible for keeping your password secure and for activity under your account.
          Provide accurate information and tell us if you suspect unauthorized access.
        </p>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <p>
          Do not misuse Kumaun: no attempts to break, overload or reverse engineer the service, no
          unlawful content, and no automated abuse of AI features.
        </p>
      </LegalSection>

      <LegalSection heading="AI-generated content">
        <p>
          AI suggestions may be inaccurate or incomplete. Always check ingredients against your
          allergies and dietary needs. Kumaun does not provide medical or nutrition advice. If a
          suggestion looks wrong, use Report suggestion on the result.
        </p>
      </LegalSection>

      <LegalSection heading="Third-party data">
        <p>
          Product data from Open Food Facts is provided under the Open Database License (ODbL).
          Nutrition data comes from USDA FoodData Central. We do not guarantee its accuracy.
        </p>
      </LegalSection>

      <LegalSection heading="Termination">
        <p>
          You can delete your account at any time in Settings &gt; Data. We may suspend accounts
          that violate these terms.
        </p>
      </LegalSection>

      <LegalSection heading="Limitation of liability">
        <p>
          Kumaun is provided as is, without warranties. To the extent permitted by law, we are not
          liable for indirect or consequential damages, or for decisions made on the basis of
          AI-generated content.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        {contact.kind === 'email' ? (
          <p>
            Questions about these terms:{' '}
            <a href={contact.href} className={LINK}>
              {contact.email}
            </a>
          </p>
        ) : (
          <p>
            Questions about these terms: see our{' '}
            <a href="/support" className={LINK}>
              Support page
            </a>
            .
          </p>
        )}
      </LegalSection>
    </LegalShell>
  );
}
