import { useT } from '../../shared/i18n/useT';
import { pageInfo } from './paging';

interface Props {
  total: number;
  limit: number;
  offset: number;
  /** How many rows this page actually holds. */
  shown: number;
  onChange(offset: number): void;
}

export function Pagination({ onChange, ...page }: Props) {
  const t = useT();
  const info = pageInfo(page);
  if (info.previousOffset === null && info.nextOffset === null) return null;
  return (
    <div className="admin-pagination">
      <span className="muted">
        {t('admin.page.range', { from: info.from, to: info.to, total: info.total })}
      </span>
      <button
        type="button"
        className="secondary"
        disabled={info.previousOffset === null}
        onClick={() => onChange(info.previousOffset ?? 0)}
      >
        {t('admin.page.previous')}
      </button>
      <button
        type="button"
        className="secondary"
        disabled={info.nextOffset === null}
        onClick={() => onChange(info.nextOffset ?? 0)}
      >
        {t('admin.page.next')}
      </button>
    </div>
  );
}
