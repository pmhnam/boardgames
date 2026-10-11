import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';
import { useT } from '../i18n/useT';

/**
 * Everything about the signed-in player behind their name, so the header stays one line on a
 * phone. `links` are the pages the header has no room to list there.
 */
export function AccountMenu({
  name,
  links,
  onSignOut,
}: {
  name: string;
  links: ReactNode;
  onSignOut(): void;
}) {
  const t = useT();
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  // Following one of its links is done with it.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="account-menu" ref={root}>
      <button
        ref={button}
        type="button"
        className="secondary account-menu-button"
        aria-label={t('nav.account', { name })}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <span className="account-menu-name">{name}</span>
        <span aria-hidden="true">▾</span>
      </button>
      <div id={panelId} className="account-menu-panel" hidden={!open}>
        <nav className="account-menu-links" aria-label={t('nav.label')}>
          {links}
        </nav>
        <div className="account-menu-row">
          <span>{t('nav.language')}</span>
          <LanguageSwitcher />
        </div>
        <button type="button" className="secondary" onClick={onSignOut}>
          {t('nav.signOut')}
        </button>
      </div>
    </div>
  );
}
