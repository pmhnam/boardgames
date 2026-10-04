import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LOCALES, type Locale } from './locales';
import { pickLocale } from './translate';

interface LocaleState {
  locale: Locale;
  setLocale(locale: Locale): void;
}

/** Kept in localStorage, unlike the session: the language is the person's, not the tab's. */
export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: pickLocale(LOCALES, navigator.languages),
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'bgp-locale' },
  ),
);

// Screen readers and the browser's own hyphenation and spellcheck go by the document language.
const applyLocale = (locale: Locale) => {
  document.documentElement.lang = locale;
};
applyLocale(useLocaleStore.getState().locale);
useLocaleStore.subscribe((state) => applyLocale(state.locale));
