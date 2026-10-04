import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorText } from '../../shared/i18n/errors';
import { useT } from '../../shared/i18n/useT';
import { joinByCode } from '../rooms/joinRoom';

/** A code read out by a friend: checked here, so a wrong one is answered where it was typed. */
export function JoinCodeForm() {
  const t = useT();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const join = useMutation({
    mutationFn: joinByCode,
    onSuccess: (room) => navigate(`/rooms/${room.id}`),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (code) join.mutate(code);
  };

  return (
    <form className="join-code" onSubmit={submit}>
      <label htmlFor="join-code-input">{t('joinCode.title')}</label>
      <div className="row">
        <input
          id="join-code-input"
          placeholder="ABC123"
          value={code}
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={join.isError}
          aria-describedby={join.isError ? 'join-code-error' : undefined}
          onChange={(event) => {
            // Codes are capitals and digits; typing one in lower case should just work.
            setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
            if (join.isError) join.reset();
          }}
        />
        <button type="submit" disabled={!code || join.isPending}>
          {join.isPending ? t('room.joining') : t('joinCode.submit')}
        </button>
      </div>
      {join.isError && (
        <p id="join-code-error" className="error" role="alert">
          {errorText(t, join.error)}
        </p>
      )}
    </form>
  );
}
