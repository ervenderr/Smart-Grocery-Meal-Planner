/**
 * Single source of truth for legal pages and AI disclosures.
 * The privacy page and the AI consent sheet both read from here so the
 * policy text and the consent text cannot drift apart.
 */

/** Single switch: set to false once the owner has reviewed the legal text. */
export const DRAFT_BANNER_ENABLED = true;
export const DRAFT_BANNER_TEXT = 'Draft: pending owner review.';
export const LEGAL_LAST_UPDATED = 'October 10, 2026';

export const LEGAL_ROUTES = {
  privacy: '/privacy',
  terms: '/terms',
  support: '/support',
} as const;

export type SupportContact =
  | { readonly kind: 'email'; readonly email: string; readonly href: string }
  | { readonly kind: 'missing' };

// Conservative plain-address check. Rejects whitespace, '?', '&', ':' and
// anything else that could inject mailto headers (subject, cc, bcc, body).
const PLAIN_EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

export function resolveSupportContact(raw: string | undefined): SupportContact {
  const email = (raw ?? '').trim();
  if (!PLAIN_EMAIL.test(email)) {
    return { kind: 'missing' };
  }
  return { kind: 'email', email, href: `mailto:${email}` };
}

export const DEFAULT_AI_PROVIDER_LABEL = 'an OpenAI-compatible AI service (currently Dahl Inference)';

export function resolveAiProviderLabel(raw: string | undefined): string {
  const label = (raw ?? '').trim();
  return label.length > 0 ? label : DEFAULT_AI_PROVIDER_LABEL;
}

export const AI_PROVIDER_LABEL = resolveAiProviderLabel(process.env.NEXT_PUBLIC_AI_PROVIDER_LABEL);

/** Verified against backend/src/modules/ai/features/{recipes,meal-plan,substitutions}.ts */
export const AI_DATA_SENT: readonly string[] = [
  'Pantry item names and quantities',
  'Ingredients of a shopping list you ask to find substitutions for',
  'Meal plan settings such as number of days and budget',
  'Preparation time preference for recipe suggestions',
];

/** Diet and allergen filters are applied on our server, never put in provider prompts. */
export const AI_DATA_NOT_SENT =
  'Your name, email, account details, or diet and allergen settings';
