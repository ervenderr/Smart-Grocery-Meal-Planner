import { describe, expect, it, vi } from 'vitest';
import { collectReleaseWarnings, logReleaseWarnings } from './release-checks';

describe('collectReleaseWarnings', () => {
  it('warns when the support email is missing or invalid', () => {
    expect(collectReleaseWarnings({}).some((w) => w.includes('NEXT_PUBLIC_SUPPORT_EMAIL'))).toBe(true);
    expect(
      collectReleaseWarnings({ NEXT_PUBLIC_SUPPORT_EMAIL: 'a@b.com?cc=x' }).some((w) =>
        w.includes('NEXT_PUBLIC_SUPPORT_EMAIL')
      )
    ).toBe(true);
  });

  it('does not warn about the support email when it is valid', () => {
    const warnings = collectReleaseWarnings({ NEXT_PUBLIC_SUPPORT_EMAIL: 'help@example.com' });
    expect(warnings.some((w) => w.includes('NEXT_PUBLIC_SUPPORT_EMAIL'))).toBe(false);
  });

  it('warns while the draft banner is enabled', () => {
    expect(collectReleaseWarnings({}).some((w) => w.includes('DRAFT_BANNER_ENABLED'))).toBe(true);
  });
});

describe('logReleaseWarnings', () => {
  it('prefixes each warning and never throws', () => {
    const warn = vi.fn();
    expect(() => logReleaseWarnings({}, warn)).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mock.calls.forEach(([m]) => expect(m).toMatch(/^\[store-readiness\] /));
  });
});
