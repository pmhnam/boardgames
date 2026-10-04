import { useCallback } from 'react';
import { en } from './en';
import { useLocaleStore } from './locale.store';
import type { Locale } from './locales';
import { interpolate, type MessageParams } from './translate';
import { vi, type MessageKey, type Messages } from './vi';

const MESSAGES: Record<Locale, Messages> = { vi, en };

export type Translate = (key: MessageKey, params?: MessageParams) => string;

export function useLocale(): Locale {
  return useLocaleStore((state) => state.locale);
}

/** The interface's text in the language the person picked. */
export function useT(): Translate {
  const locale = useLocale();
  return useCallback((key, params) => interpolate(MESSAGES[locale][key], params), [locale]);
}
