---
phase: 02-reliable-ai-suggestions
reviewed: 2026-10-09T00:00:00Z
depth: standard
files_reviewed: 35
files_reviewed_list:
  - backend/prisma/migrations/20261009120000_ai_usage_and_cache/migration.sql
  - backend/prisma/schema.prisma
  - backend/src/app.ts
  - backend/src/config/env.schema.ts
  - backend/src/middleware/errorHandler.ts
  - backend/src/middleware/rateLimiter.ts
  - backend/src/modules/ai/ai-cache-key.ts
  - backend/src/modules/ai/ai-cache.repository.ts
  - backend/src/modules/ai/ai-quota.repository.ts
  - backend/src/modules/ai/ai.controller.ts
  - backend/src/modules/ai/ai.deps.ts
  - backend/src/modules/ai/ai.errors.ts
  - backend/src/modules/ai/ai.orchestrator.ts
  - backend/src/modules/ai/ai.routes.ts
  - backend/src/modules/ai/dietary-filter.ts
  - backend/src/modules/ai/features/apply-dietary.ts
  - backend/src/modules/ai/features/meal-plan.ts
  - backend/src/modules/ai/features/recipes.ts
  - backend/src/modules/ai/features/substitutions.ts
  - backend/src/modules/ai/json-extract.ts
  - backend/src/modules/ai/prompt-sanitize.ts
  - backend/src/modules/ai/providers/openai-compatible.provider.ts
  - backend/src/modules/food/food.controller.ts
  - backend/src/modules/food/food.routes.ts
  - backend/src/modules/food/food.service.ts
  - backend/src/modules/food/food.validation.ts
  - backend/src/modules/food/off.client.ts
  - backend/src/modules/food/outbound-throttle.ts
  - backend/src/modules/food/usda.client.ts
  - frontend/components/ai/ai-recipe-suggestions-modal.tsx
  - frontend/components/food/barcode-lookup.tsx
  - frontend/lib/api/ai.ts
  - frontend/lib/api/errors.ts
  - frontend/lib/api/food.ts
  - scripts/smoke-prod.sh
findings:
  critical: 2
  warning: 12
  info: 8
  total: 22
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-10-09
**Depth:** standard
**Files Reviewed:** 35
**Status:** issues_found

## Summary

The core mechanics are mostly sound:
- The quota uses a single atomic upsert-with-guard inside one transaction. The rollback of the global increment when the user check fails is correct, and refunds use the reserved day.
- Food URLs have hard-coded hosts, with a digit-only barcode and `encodeURIComponent` on the query. There is no SSRF vector.
- The USDA key travels in a header and is not logged. The provider adapter never logs the key, headers or prompts.
- The cache key excludes `userId`, and per-user work (dietary filter, `matchPercentage`) runs after the cache, so there is no cross-user data leakage.

Two defects break advertised behaviour. First, the dietary filter does not recognise the restriction values the frontend actually stores, so it silently fails open. Second, 8 to 14 day meal plans can never validate. Both are in the Critical section.

The known gap (a DB error on cache read surfacing as an error instead of a miss) is confirmed and is worse than described. The error handler maps it to HTTP 400, and the food path also fails after a successful upstream fetch. There are further robustness issues around the repair retry, error-handler leakage, input coercion and the cache-semantics UX.

## Structural Findings (fallow)

None provided.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Dietary filter fails open for every restriction the UI can save (underscore vs hyphen mismatch)

**File:** `backend/src/modules/ai/dietary-filter.ts:30-45,59,84-85`
**Issue:** `TAG_TERMS` is keyed `gluten-free`, `dairy-free`, `nut-free`, with hyphens. The frontend stores `gluten_free`, `dairy_free` and `nut_free` with underscores:
- `frontend/components/settings/preferences-settings.tsx:28-30`
- `frontend/components/ai/ai-meal-plan-modal.tsx:41-45`

`normalizeRestrictions` only lowercases and collapses whitespace, so `gluten_free` misses the `TAG_TERMS` lookup. `freeTextTokens` then splits it into `gluten` and `free`. `free` is a stop word, so the only forbidden term left is the literal word `gluten`. As a result:
- A gluten-free user still receives recipes containing flour, bread or pasta.
- A dairy-free user still receives milk, cheese and butter.
- A nut-free user still receives almonds, cashews and the rest.

This is the allergen-safety path. It is covered only by the "best-effort" disclaimer, and in practice it does nothing for three of the seven options. The same free-text fallback also fails open for "gluten free" and "nut allergy".
**Fix:**
```ts
export function normalizeRestrictions(...lists) {
  ...
    .map((item) => String(item).toLowerCase().trim().replace(/[_\s]+/g, ' ').replace(/ /g, ' '))
}
// and look TAG_TERMS up through a canonical form:
const canon = (s: string) => s.toLowerCase().replace(/[_\s-]+/g, '-').trim();
const TAG_INDEX = new Map(Object.entries(TAG_TERMS).map(([k, v]) => [canon(k), v]));
// buildForbiddenTerms: const known = TAG_INDEX.get(canon(restriction));
```
Add a test that feeds each `DIETARY_OPTIONS` value from the frontend through `buildForbiddenTerms` and asserts a non-trivial term list. Consider failing closed: if a restriction yields zero known terms, log a warning at least.

### CR-02: Meal plans of 8-14 days can never pass validation, so they burn two provider calls and return 503

**File:** `backend/src/modules/ai/features/meal-plan.ts:19,44,62`; `backend/src/modules/ai/ai.validation.ts` (`daysCount` is 1-14)
**Issue:** The request validator allows `daysCount` up to 14, and the prompt asks for a "N-day meal plan". The response schema constrains `day` to `0..6`, and the system prompt tells the model the same. For `daysCount > 7` the model either emits `day >= 7`, which fails Zod, or compresses the plan, which contradicts the request. A failure triggers the repair call, then `AI_UNAVAILABLE` plus a refund. Every attempt costs two paid provider calls and ends in an error that blames the provider. `meals.max(60)` is also tight for 14 days of breakfast, lunch, dinner and snacks (14 x 4 = 56, with no headroom).
**Fix:** Pick one contract. Either cap `daysCount` at 7 in `validateAIMealPlan` and the frontend, or allow `day` up to 13 in `mealSchema`, update the prompt text, and raise `meals.max` to about 70.
```ts
day: z.coerce.number().int().min(0).max(13),
meals: z.array(mealSchema).min(1).max(70),
```
Also reject `day >= daysCount` after parsing.

## Warnings

### WR-01: A DB error during cache read is not degraded to a miss (known gap, confirmed and worse than expected)

**File:** `backend/src/modules/ai/ai.orchestrator.ts:100-105,180`; `backend/src/modules/food/food.service.ts:129,161`; `backend/src/middleware/errorHandler.ts:101-103`
**Issue:** `readCache` calls `getCached` with no try/catch, so any Prisma failure aborts the request before the provider is ever consulted. `ai_cache` is an optimisation, not a dependency. `errorHandler` also maps `PrismaClientKnownRequestError` to HTTP 400 "Database operation failed". A transient DB error therefore becomes a client error, and the frontend shows it as the user's fault. `PrismaClientInitializationError` and `UnknownRequestError` take the generic branch (see WR-03).
**Fix:** Wrap the read and treat failure as a miss, as `storeResult` already does for writes:
```ts
async function readCache<T>(key, now, schema): Promise<T | null> {
  try {
    const stored = await getCached(key, now);
    if (stored === null) return null;
    const parsed = schema.safeParse(stored);
    return parsed.success ? parsed.data : null;
  } catch (error) {
    logger.warn('AI cache read failed', { error: describeError(error) });
    return null;
  }
}
```
Do the same in `food.service.ts` (both `getCached` calls). Note that if the DB is down the quota reserve will still fail, and that already maps to `AI_UNAVAILABLE` 503. Also consider changing the `errorHandler` Prisma mapping for non-P2002/P2025 codes to 500.

### WR-02: Food lookup fails after a successful upstream fetch if the cache write fails

**File:** `backend/src/modules/food/food.service.ts:146,151,171-178`
**Issue:** All three `setCached` calls are unguarded. If the write throws after the throttle slot was consumed and the upstream call succeeded, the user gets a 400/500 and the result is lost. For a not-found result, a cache write failure turns a clean 404 into a server error.
**Fix:** Wrap in a `safeStore` helper (try/catch with `logger.warn`) and always return or throw the computed result.

### WR-03: The generic error branch returns raw `err.message` to clients in production

**File:** `backend/src/middleware/errorHandler.ts:115-117,133-140`
**Issue:** For any non-AppError that is not a recognised JWT or Prisma name, `message = err.message` goes straight into the JSON response with status 500. This reaches clients unfiltered:
- Prisma `PrismaClientInitializationError` text ("Can't reach database server at host:port").
- `PrismaClientUnknownRequestError` and `PrismaClientValidationError` text, which embeds the query invocation snippet.
- Any `TypeError` text.

The new cache and quota DB paths make these reachable (see WR-01). The response also lets AppError `details` override fields earlier in the object: `...appError.details` is spread after `status`, `statusCode` and `message`, so a details key named `message` would clobber them.
**Fix:** In production return a fixed message for non-operational errors:
```ts
else {
  message = isProduction ? 'Internal server error' : (err.message || 'Something went wrong');
}
```
Spread `details` first, then the fixed fields.

### WR-04: `.escape()` on the nutrition query corrupts upstream searches and the cache key

**File:** `backend/src/modules/food/food.validation.ts:17`
**Issue:** `escape()` HTML-encodes `& < > ' " /`. The escaped string is what `req.query.query` holds afterwards, so the controller forwards it to USDA and uses it for the cache key. For example, "baker's chocolate" becomes `baker&#x27;s chocolate`, and "mac & cheese" becomes `mac &amp; cheese`. The search then returns wrong or empty results, and the cache is polluted. The length check also runs before escaping, so the effective length is not bounded to 80. The value is only ever URL-encoded into a query string and never rendered as HTML, so escaping is unneeded.
**Fix:** Drop `.escape()`. Optionally restrict with `.matches(/^[\p{L}\p{N} .,'&()%-]+$/u)`.

### WR-05: Food endpoints are unthrottled per user, so one account can exhaust the global OFF budget and grow the cache table

**File:** `backend/src/modules/food/food.routes.ts:13-16`; `backend/src/modules/food/outbound-throttle.ts:40-41`; `backend/src/modules/food/food.service.ts:135`
**Issue:** The routes have `authenticate` but no per-user limiter, unlike `/ai`. The OFF throttle is a single process-wide window of 12/min. A user can request distinct uncached 8-14 digit barcodes and keep the window saturated. Every other user then gets `LOOKUP_THROTTLED` (429). Each successful or not-found unique barcode also writes a persistent `ai_cache` row (30-day and 1-day TTL). `pruneExpired` runs only after AI writes, so food-only traffic never prunes. The throttle also counts slots before the request, so failed upstream calls consume budget.
**Fix:** Add a per-user limiter (e.g. `foodLimiter`: 10/min keyed on user id) to `food.routes.ts`. Reject barcodes that fail a GTIN checksum before touching the cache or throttle. Call `pruneSometimes` from food writes too.

### WR-06: The global daily AI cap can be exhausted by a handful of accounts

**File:** `backend/src/modules/ai/ai-quota.repository.ts:55-66`; `backend/src/config/env.schema.ts:100-101`
**Issue:** Defaults are 20 per user and 100 global, so 5 accounts deny AI to everyone. The smoke script shows that signup is unauthenticated and instant. The global scope is reserved first and has no per-IP or signup friction. The outcome is a cheap denial-of-service on a paid resource.
**Fix:** Consider an email-verification requirement before AI access, or a lower limit for accounts under 24 hours old. At minimum alert when the global count passes 80%. Also add `.max()` bounds on the env limits.

### WR-07: Repair retry echoes unstripped reasoning and has no overall deadline

**File:** `backend/src/modules/ai/ai.orchestrator.ts:56-85`; `backend/src/config/env.schema.ts:97`; `frontend/lib/api/ai.ts:70`
**Issue:**
- `repairMessages` replays `reply.slice(0, 6000)` as the assistant turn. For reasoning models (the module header notes MiniMax emits `<think>...`) the first 6000 chars are often only the thinking block, so the actual JSON is truncated off and the repair prompt is meaningless.
- Each call gets its own `AbortSignal.timeout(timeoutMs)`. Worst case is 2 x `AI_TIMEOUT_MS`. With the default 40s that is 80s, already near the frontend's 90s axios timeout. With the permitted max of 110s it is 220s, past most proxy limits. The quota stays reserved and the client has gone.
- The `bad_response` that `readBody` raises from a timeout while reading the body hides the real cause (`timeout`) in logs.

**Fix:** Strip reasoning first with `stripReasoning(first)`, and take the tail (`.slice(-MAX_REPLY_ECHO)`) rather than the head. Track a deadline (`const deadline = Date.now() + totalBudgetMs`) and pass `Math.min(timeoutMs, remaining)` to the second call, or skip the repair when less than a few seconds remain. Lower the env max for `AI_TIMEOUT_MS`.

### WR-08: `extractJson` locks onto the first `{` or `[` in prose

**File:** `backend/src/modules/ai/json-extract.ts:57-66`
**Issue:** `cleaned.search(/[{[]/)` picks the first bracket. A reply such as "Here are 3 [great] recipes: {...}" yields `[great]`, which is not valid JSON. `JSON.parse` fails and the whole extraction throws, forcing a needless repair call (and possible failure). A valid object after a stray bracket is never tried. `stripFences` also removes triple backticks that appear inside JSON strings.
**Fix:** Iterate candidates, trying each `{`/`[` start index until one balances and parses, preferring objects for object schemas.

### WR-09: Untrusted `image_front_small_url` is passed to clients without scheme validation

**File:** `backend/src/modules/food/off.client.ts:31`; `backend/src/modules/food/food.service.ts:116`
**Issue:** OFF is crowd-sourced. The value is only `z.string().max(300)`, so `javascript:` or `data:` URLs and arbitrary tracking hosts are persisted in a 30-day shared cache and served to every user. `barcode-lookup.tsx` currently does not render it, but the API contract exposes it, and any later `<img src>` or `<a href>` use becomes an injection or tracking vector.
**Fix:** Accept only `https:` URLs on an allow-listed host (`images.openfoodfacts.org`) and otherwise return `null`.
```ts
const safeUrl = (v?: string) => { try { const u = new URL(v ?? ''); return u.protocol === 'https:' && u.hostname.endsWith('openfoodfacts.org') ? u.href : null; } catch { return null; } };
```

### WR-10: The USDA kcal fallback by name can return kilojoules as kcal

**File:** `backend/src/modules/food/usda.client.ts:13-17,35-48`
**Issue:** The nutrient schema drops `unitName`. When no entry has `nutrientNumber === '208'`, `pick` falls back to the first nutrient whose `nutrientName` is exactly "Energy". USDA FDC lists both the kcal and kJ entries (kJ is nutrient 268) under that same name. For Foundation foods, which only carry Atwater energy (957/958), the name match can hit the kJ entry and report roughly 4.2x too high as `energyKcal`. This reaches users as incorrect nutrition data.
**Fix:** Capture `unitName` and require `KCAL` for the energy fallback (`n.unitName?.toUpperCase() === 'KCAL'`). Add 957 and 958 to the accepted numbers.

### WR-11: express-validator accepts numeric strings but the code treats them as absent, so filters are silently ignored

**File:** `backend/src/modules/ai/ai.controller.ts:65,121`; `backend/src/modules/ai/features/recipes.ts:80-83`; `backend/src/modules/ai/features/substitutions.ts:53-54`; `backend/src/modules/ai/ai.validation.ts`
**Issue:** `isInt`, `isFloat` and `isBoolean` accept strings such as `"30"` and `"false"`.
- `maxPrepTime: "30"` fails the `typeof === 'number'` test, so the prompt says "No prep time limit." while the cache key carries `"30"`. The user's constraint is dropped and an unconstrained answer is cached under that key.
- `budgetCents: "5000"` has the same problem in substitutions ("No budget given").
- `usePantry: "false"` is truthy in `usePantry ? loadPantry : []`, so the pantry is used when the caller said not to.

**Fix:** Add `.toInt()`, `.toFloat()` and `.toBoolean()` sanitizers to the validator chains so the controller receives typed values.

### WR-12: Cache semantics make "Generate New Suggestions" a no-op, and empty results are cached for a week

**File:** `frontend/components/ai/ai-recipe-suggestions-modal.tsx:211-223`; `backend/src/modules/ai/ai.orchestrator.ts:88-92,147-161`
**Issue:**
- The "Generate New Suggestions" button re-posts the identical request. It hits the 24h cache and returns the same recipes (`cached: true`), so the user never gets new suggestions and quota is not even spent. The label is misleading.
- `substitutionsPayloadSchema` allows an empty array. A flaky empty `{"substitutions":[]}` reply is validated and cached for 7 days for everyone with the same inputs.
- Recipe and meal-plan payloads are cached for 24h and shared across users, so variety is zero by design.

**Fix:** Add a `refresh` flag that bypasses the read (with quota consumed) or an explicit variation seed, or relabel the button. Do not cache empty substitution results, or give them a short TTL.

## Info

### IN-01: No single-flight or recheck, so concurrent identical requests each spend quota and provider calls

**File:** `backend/src/modules/ai/ai.orchestrator.ts:180-189`
**Issue:** N simultaneous cache misses for the same key each reserve quota and call the provider (and the repair call). The cache is not rechecked after the reserve.
**Fix:** An in-process `Map<string, Promise>` for in-flight keys, plus a second `readCache` after reserving (refund if it hits).

### IN-02: Outbound fetches follow redirects with a custom auth header

**File:** `backend/src/modules/food/usda.client.ts:60-63`; `backend/src/modules/food/off.client.ts:81-84`
**Issue:** Default `redirect: 'follow'` would forward the custom `X-Api-Key` header (undici only strips `Authorization` and cookies cross-origin) if USDA ever redirected off-host.
**Fix:** Pass `redirect: 'error'` (or `'manual'`) on both fetches.

### IN-03: Cached food payloads are cast, not validated

**File:** `backend/src/modules/food/food.service.ts:129,161`
**Issue:** `getCached(...) as CachedOff | null` and `as { results: UsdaResult[] }`. A malformed or older-shape row (e.g. `hit.product` undefined) crashes later or leaks bad data. The AI path validates with Zod and the food path does not.
**Fix:** `safeParse` the cached value with a small Zod schema and treat failure as a miss.

### IN-04: The cache key omits the model, the prompt version and the inputs the prompt actually sees

**File:** `backend/src/modules/ai/ai-cache-key.ts:20-23`; `backend/src/modules/ai/features/recipes.ts:121`; `backend/src/modules/ai/features/meal-plan.ts:81`
**Issue:**
- Changing `AI_MODEL` or the system prompt serves stale results unless someone remembers to bump `schemaVersion`.
- Recipes and meal-plan keys use pantry names only. The prompt includes quantities, units and categories, so user A's quantities shape what user B receives.
- The prompt only sees the first 60 items (in DB order) while the key covers all names sorted.

**Fix:** Include `config.ai.model` and a prompt hash in the key inputs. Align key inputs with prompt inputs.

### IN-05: Provider adapter does not drain error bodies and logs provider messages

**File:** `backend/src/modules/ai/providers/openai-compatible.provider.ts:75-93`
**Issue:** For 401/402/429/5xx the response body is never consumed, which holds the connection until garbage collection. For 400 the provider's `error.message` (up to 500 chars) is logged, which can echo prompt fragments despite the "never logs prompts" header comment. There is no cap on successful body size.
**Fix:** Call `await res.body?.cancel()` before throwing, and log only the status plus a fixed reason.

### IN-06: Dead error handling and `any` in the controller

**File:** `backend/src/modules/ai/ai.controller.ts:51,64,147-164`
**Issue:** `getStatus` catches only to log and rethrow. `logger.error('...:', error)` has the wrong signature shape. `(req as any).user.id` and `item: any` bypass typing.
**Fix:** Remove the try/catch and type the request with the existing authenticated-request interface.

### IN-07: Throttle and rate-limit 429s lack `Retry-After`

**File:** `backend/src/modules/food/food.service.ts:82-86`; `backend/src/middleware/errorHandler.ts:133-140`
**Issue:** `retryAfterSeconds` is only in the body, and AI quota 429s do not include the header either.
**Fix:** Set `res.setHeader('Retry-After', ...)` in `errorHandler` when `details.retryAfterSeconds` or quota `resetsAt` is present.

### IN-08: Zero-result UX after dietary filtering

**File:** `frontend/components/ai/ai-recipe-suggestions-modal.tsx:35-38,103,136`
**Issue:** If every suggestion is filtered out, `suggestions.length === 0` returns the UI to the empty state, the toast says "Generated 0 recipe suggestions!", and `DietFilterNotice` (rendered only in the non-empty branch) never shows. The user spent quota and sees no explanation.
**Fix:** Render `DietFilterNotice` in the empty state when `filteredOut > 0`, and fix the toast text.

---

_Reviewed: 2026-10-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
