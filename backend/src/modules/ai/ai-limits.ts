/**
 * Pure AI limit resolution (free vs entitled) and UTC month helpers.
 */

export interface AiLimitConfig {
  readonly userDaily: number;
  readonly globalDaily: number;
  readonly paidUserDaily: number;
  /** 0 disables the monthly cap for free users. */
  readonly freeMonthly: number;
  /** 0 disables the monthly cap for entitled users. */
  readonly paidMonthly: number;
}

export interface UserAiLimits {
  readonly userDaily: number;
  readonly userMonthly: number | null;
  readonly globalDaily: number;
}

export function resolveUserLimits(entitled: boolean, cfg: AiLimitConfig): UserAiLimits {
  const monthly = entitled ? cfg.paidMonthly : cfg.freeMonthly;
  return {
    userDaily: entitled ? cfg.paidUserDaily : cfg.userDaily,
    userMonthly: monthly > 0 ? monthly : null,
    globalDaily: cfg.globalDaily,
  };
}

/** First day of the UTC month, as YYYY-MM-01. */
export function utcMonthStart(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/** ISO timestamp of the next UTC month start. */
export function nextUtcMonthStart(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}
