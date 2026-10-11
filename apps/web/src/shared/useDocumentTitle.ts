import { useEffect } from 'react';
import { useT } from './i18n/useT';

/**
 * Names the page on its browser tab, ahead of the app's own name. Null leaves the app's name
 * alone, which is also what the tab goes back to when the page is left.
 */
export function useDocumentTitle(title: string | null) {
  const app = useT()('app.name');

  useEffect(() => {
    document.title = title === null ? app : `${title} · ${app}`;
    return () => {
      document.title = app;
    };
  }, [title, app]);
}
