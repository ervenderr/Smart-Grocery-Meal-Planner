/**
 * CORS helpers (pure: no dependency on env.config).
 */

import type { RequestHandler } from "express";
import type { CorsOptions } from "cors";

export type OriginPredicate = (origin: string) => boolean;

export interface OriginPredicateOptions {
  readonly origins: readonly string[];
  readonly previewProject: string;
  readonly previewScope?: string;
}

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

/**
 * Matches Vercel generated URLs of one project in one scope:
 * <project>-<9 char hash>-<scope>, <project>-git-<branch>-<scope>, <project>-<scope>
 *
 * Security: the "<branch>-<scope>" boundary is ambiguous when the branch may
 * contain hyphens, because Vercel team slugs are attacker-registrable
 * (team "evil-<scope>" yields kitcha-git-x-evil-<scope>.vercel.app). The
 * branch segment is therefore a single hyphen-free token, so everything after
 * it must be exactly the configured scope. Previews of hyphenated branches must
 * be listed explicitly in CORS_ORIGIN. Residual risk: the hash and bare forms
 * cannot be disambiguated by pattern alone (an attacker team named after a
 * trailing part of the scope); keep VERCEL_PREVIEW_SCOPE unset to disable.
 */
function buildPreviewRegExp(project: string, scope: string): RegExp {
  const p = escapeRegExp(project);
  const s = escapeRegExp(scope);
  return new RegExp(`^https://${p}(-git-[a-z0-9]+|-[a-z0-9]{9})?-${s}\\.vercel\\.app$`);
}

export function buildOriginPredicate(opts: OriginPredicateOptions): OriginPredicate {
  const exact = new Set(opts.origins.map(normalizeOrigin));
  const preview = opts.previewScope
    ? buildPreviewRegExp(opts.previewProject, opts.previewScope)
    : undefined;

  return (origin: string): boolean => {
    const normalized = normalizeOrigin(origin);
    return exact.has(normalized) || (preview !== undefined && preview.test(normalized));
  };
}

export function originGuard(isAllowed: OriginPredicate): RequestHandler {
  return (req, res, next) => {
    const origin = req.header("origin");
    if (origin === undefined || isAllowed(origin)) {
      next();
      return;
    }
    res.status(403).json({
      status: "error",
      statusCode: 403,
      message: "Origin not allowed",
    });
  };
}

export function buildCorsOptions(isAllowed: OriginPredicate): CorsOptions {
  return {
    origin: (origin, callback) => {
      callback(null, !origin || isAllowed(origin));
    },
    credentials: true,
    optionsSuccessStatus: 200,
    maxAge: 86400,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  };
}
