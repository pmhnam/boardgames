import { useLocale } from '../../shared/i18n/useT';
import { AVALON_TEXT, type AvalonText } from './text';

/** The table's text in the language the viewer picked. */
export function useAvalonText(): AvalonText {
  return AVALON_TEXT[useLocale()];
}
