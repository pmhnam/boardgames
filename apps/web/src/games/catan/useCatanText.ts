import { useLocale } from '../../shared/i18n/useT';
import { CATAN_TEXT, type CatanText } from './text';

/** The table's text in the language the viewer picked. */
export function useCatanText(): CatanText {
  return CATAN_TEXT[useLocale()];
}
