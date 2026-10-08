interface ErrorBody {
  message?: unknown;
  error?: unknown;
  code?: unknown;
}

function getBody(error: unknown): ErrorBody | undefined {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return undefined;
  }
  const response = (error as { response?: unknown }).response;
  if (typeof response !== 'object' || response === null || !('data' in response)) {
    return undefined;
  }
  const data = (response as { data?: unknown }).data;
  return typeof data === 'object' && data !== null ? (data as ErrorBody) : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

/** Returns the server's message (or error) string, else the fallback. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  const body = getBody(error);
  return nonEmptyString(body?.message) ?? nonEmptyString(body?.error) ?? fallback;
}

/** Returns the machine-readable error code (e.g. AI_QUOTA_EXCEEDED) if present. */
export function getApiErrorCode(error: unknown): string | undefined {
  return nonEmptyString(getBody(error)?.code);
}
