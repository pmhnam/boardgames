import { useSearchParams } from 'react-router-dom';
import { parseListParams, withListChange, type ListParams } from './paging';

/** A list's filters and page, kept in the address bar so a view can be linked to and reloaded. */
export function useListSearch(): {
  search: URLSearchParams;
  page: ListParams;
  change(changes: Record<string, string | number | null>): void;
} {
  const [search, setSearch] = useSearchParams();
  return {
    search,
    page: parseListParams(search),
    change: (changes) =>
      setSearch((current) => withListChange(current, changes), { replace: true }),
  };
}
