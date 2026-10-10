import { useLocale } from '../../shared/i18n/useT';
import { HARMONIES_TEXT, type HarmoniesText } from './text';

/** The table's text in the language the viewer picked. */
export function useHarmoniesText(): HarmoniesText {
  return HARMONIES_TEXT[useLocale()];
}
