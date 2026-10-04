import { useLocaleStore } from './locale.store';
import { LOCALES, type Locale } from './locales';
import { useT } from './useT';

/** Each language under its own name, so it can be found by someone who cannot read the current one. */
const LOCALE_NAMES: Record<Locale, string> = { vi: 'Tiếng Việt', en: 'English' };

export function LanguageSwitcher() {
  const t = useT();
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);

  return (
    <div className="language-switcher" role="group" aria-label={t('nav.language')}>
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          title={LOCALE_NAMES[option]}
          aria-label={LOCALE_NAMES[option]}
          aria-pressed={option === locale}
          onClick={() => setLocale(option)}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
