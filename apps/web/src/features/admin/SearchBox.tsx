import { useState, type FormEvent } from 'react';
import { useT } from '../../shared/i18n/useT';

interface Props {
  label: string;
  /** What the list is currently filtered by. */
  value: string;
  onSearch(value: string): void;
}

/** Searches when asked to, not on every keystroke: each search is a request to the server. */
export function SearchBox({ label, value, onSearch }: Props) {
  const t = useT();
  const [text, setText] = useState(value);
  // The filter changed elsewhere (a link, the back button): show what is being searched for.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(value);
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSearch(text.trim());
  };

  return (
    <form className="admin-search" role="search" onSubmit={submit}>
      <label>
        {label}
        <input
          type="search"
          value={text}
          maxLength={64}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <button type="submit" className="secondary">
        {t('admin.filter.search')}
      </button>
    </form>
  );
}
