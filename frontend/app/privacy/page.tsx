import type { Metadata } from 'next';
import { LegalSection, LegalShell } from '@/components/legal/legal-shell';
import {
  AI_DATA_NOT_SENT,
  AI_DATA_SENT,
  AI_PROVIDER_LABEL,
  resolveSupportContact,
} from '@/lib/legal/legal-config';

export const metadata: Metadata = {
  title: 'Privacy Policy | Kitcha',
  description:
    'How Kitcha collects, uses and protects your data, including how AI features process your pantry information.',
  robots: { index: true, follow: true },
};

const LINK = 'underline';

export default function PrivacyPage() {
  const contact = resolveSupportContact(process.env.NEXT_PUBLIC_SUPPORT_EMAIL);

  return (
    <LegalShell title="Privacy Policy">
      <LegalSection heading="Data we collect">
        <ul className="list-disc space-y-1 pl-6">
          <li>Account email, optional first and last name, and a hashed password</li>
          <li>Pantry items, recipes, meal plans and shopping lists you create</li>
          <li>Budget and preference settings</li>
          <li>AI usage counters, and any AI reports you submit</li>
        </ul>
      </LegalSection>

      <LegalSection heading="How we use it">
        <p>
          We use your data only to run Kitcha: showing your pantry, planning meals, building
          shopping lists, tracking your budget and keeping your account secure. We do not sell your
          data.
        </p>
      </LegalSection>

      <LegalSection heading="AI processing and providers">
        <p>
          When you use an AI feature, Kitcha sends a request to {AI_PROVIDER_LABEL}. The request
          contains:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          {AI_DATA_SENT.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>We do not send: {AI_DATA_NOT_SENT}.</p>
        <p>
          We ask for your consent before you first use an AI feature, and you can withdraw it any
          time in Settings &gt; Privacy. Responses may be cached on our server without any user
          identifiers so identical requests do not need to be repeated.
        </p>
      </LegalSection>

      <LegalSection heading="Third-party data">
        <p>
          Product information comes from{' '}
          <a href="https://openfoodfacts.org" className={LINK} rel="noopener noreferrer">
            Open Food Facts
          </a>
          , available under the{' '}
          <a
            href="https://opendatacommons.org/licenses/odbl/1-0/"
            className={LINK}
            rel="noopener noreferrer"
          >
            Open Database License (ODbL)
          </a>
          . Nutrition data comes from USDA FoodData Central, which is public-domain data.
        </p>
      </LegalSection>

      <LegalSection heading="Retention and account deletion">
        <p>
          We keep your data while your account exists. In Settings &gt; Data, Delete account
          permanently removes your pantry, recipes, meal plans, shopping lists, budget, AI usage and
          reports. Zapier webhooks you configured stop working; external services you connected do
          not receive a deletion notice.
        </p>
      </LegalSection>

      <LegalSection heading="Your choices">
        <p>
          You can withdraw AI consent, edit or delete your data, and delete your account at any time
          from within the app.
        </p>
      </LegalSection>

      <LegalSection heading="Children">
        <p>Kitcha is not directed to children under 13 and we do not knowingly collect their data.</p>
      </LegalSection>

      <LegalSection heading="Contact">
        {contact.kind === 'email' ? (
          <p>
            Questions about this policy:{' '}
            <a href={contact.href} className={LINK}>
              {contact.email}
            </a>
          </p>
        ) : (
          <p>
            Questions about this policy: see our{' '}
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
