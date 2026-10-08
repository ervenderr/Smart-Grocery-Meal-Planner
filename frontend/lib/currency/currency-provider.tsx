'use client';

import { createContext, useContext, useMemo } from 'react';
import { usePreferences } from '@/lib/hooks/use-preferences';
import { isSupportedCurrency } from './currencies';
import {
  DEFAULT_CURRENCY,
  currencySymbol,
  formatCurrency,
  formatCurrencyCompact,
} from './format';

interface CurrencyContextValue {
  currency: string;
  format: (cents: number) => string;
  compact: (cents: number) => string;
  symbol: string;
}

function buildValue(currency: string): CurrencyContextValue {
  return {
    currency,
    format: (cents) => formatCurrency(cents, currency),
    compact: (cents) => formatCurrencyCompact(cents, currency),
    symbol: currencySymbol(currency),
  };
}

const CurrencyContext = createContext<CurrencyContextValue>(buildValue(DEFAULT_CURRENCY));

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { data } = usePreferences();
  const stored = data?.currency;
  const currency = stored && isSupportedCurrency(stored) ? stored : DEFAULT_CURRENCY;
  const value = useMemo(() => buildValue(currency), [currency]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  return useContext(CurrencyContext);
}
