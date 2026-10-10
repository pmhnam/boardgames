import { NavLink, Outlet } from 'react-router-dom';
import { useT } from '../../shared/i18n/useT';
import type { MessageKey } from '../../shared/i18n/vi';
import './admin.css';

const SECTIONS: { to: string; label: MessageKey }[] = [
  { to: '/admin/configs', label: 'admin.tab.configs' },
  { to: '/admin/rooms', label: 'admin.tab.rooms' },
  { to: '/admin/matches', label: 'admin.tab.matches' },
  { to: '/admin/players', label: 'admin.tab.players' },
];

export function AdminLayout() {
  const t = useT();
  return (
    <div className="stack">
      <div className="admin-head">
        <h1>{t('admin.title')}</h1>
        <nav className="admin-tabs" aria-label={t('admin.sections')}>
          {SECTIONS.map((section) => (
            <NavLink key={section.to} to={section.to}>
              {t(section.label)}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
