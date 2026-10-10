import { describe, expect, it } from 'vitest';
import {
  AI_DATA_NOT_SENT,
  AI_DATA_SENT,
  DEFAULT_AI_PROVIDER_LABEL,
  LEGAL_ROUTES,
  resolveAiProviderLabel,
  resolveSupportContact,
} from './legal-config';

describe('resolveSupportContact', () => {
  it('builds a mailto link for a valid address', () => {
    expect(resolveSupportContact('help@kitcha.app')).toEqual({
      kind: 'email',
      email: 'help@kitcha.app',
      href: 'mailto:help@kitcha.app',
    });
  });

  it('trims whitespace before building the href', () => {
    expect(resolveSupportContact('  help@kitcha.app  ')).toEqual({
      kind: 'email',
      email: 'help@kitcha.app',
      href: 'mailto:help@kitcha.app',
    });
  });

  it('returns missing for unset, empty, malformed or injected values', () => {
    expect(resolveSupportContact(undefined)).toEqual({ kind: 'missing' });
    expect(resolveSupportContact('')).toEqual({ kind: 'missing' });
    expect(resolveSupportContact('not-an-email')).toEqual({ kind: 'missing' });
    expect(resolveSupportContact('a@b.c?subject=x')).toEqual({ kind: 'missing' });
    expect(resolveSupportContact('a@b.co&cc=x@y.zz')).toEqual({ kind: 'missing' });
    expect(resolveSupportContact('a b@c.com')).toEqual({ kind: 'missing' });
  });
});

describe('LEGAL_ROUTES', () => {
  it('exposes the three public routes', () => {
    expect(LEGAL_ROUTES).toEqual({ privacy: '/privacy', terms: '/terms', support: '/support' });
  });
});

describe('AI disclosures', () => {
  it('lists pantry names as sent and excludes account details', () => {
    expect(AI_DATA_SENT.length).toBeGreaterThan(0);
    expect(AI_DATA_SENT).toContain('Pantry item names and quantities');
    expect(AI_DATA_NOT_SENT).toMatch(/name/i);
    expect(AI_DATA_NOT_SENT).toMatch(/email/i);
    expect(AI_DATA_NOT_SENT).toMatch(/account/i);
  });

  it('states that diet and allergen settings are not sent (matches backend prompts)', () => {
    expect(AI_DATA_SENT.join(' ')).not.toMatch(/diet|allerg/i);
    expect(AI_DATA_NOT_SENT).toMatch(/diet/i);
  });
});

describe('resolveAiProviderLabel', () => {
  it('returns the default when unset or blank', () => {
    expect(resolveAiProviderLabel(undefined)).toBe(DEFAULT_AI_PROVIDER_LABEL);
    expect(resolveAiProviderLabel('   ')).toBe(DEFAULT_AI_PROVIDER_LABEL);
  });

  it('trims a custom label', () => {
    expect(resolveAiProviderLabel(' Groq ')).toBe('Groq');
  });
});
