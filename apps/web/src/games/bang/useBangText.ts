import { useLocale } from '../../shared/i18n/useT';
import { BANG_TEXT, type BangText } from './text';

/** The table's text in the language the viewer picked. */
export function useBangText(): BangText {
  return BANG_TEXT[useLocale()];
}
