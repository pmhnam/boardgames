import type { AuthSessionDto, GuestLoginRequest } from '@bgp/shared-types';
import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api } from '../../shared/api/http';
import { errorText } from '../../shared/i18n/errors';
import { useT } from '../../shared/i18n/useT';
import { useAuthStore } from './auth.store';

export function GuestLoginForm() {
  const t = useT();
  const [displayName, setDisplayName] = useState('');
  const setSession = useAuthStore((state) => state.setSession);

  const login = useMutation({
    mutationFn: (body: GuestLoginRequest) => api<AuthSessionDto>('POST', '/auth/guest', body),
    onSuccess: setSession,
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (displayName.trim()) login.mutate({ displayName: displayName.trim() });
  };

  return (
    <form className="card narrow" onSubmit={submit}>
      <h1>{t('login.title')}</h1>
      <p className="muted login-intro">{t('login.intro')}</p>
      <label htmlFor="display-name">{t('login.displayName')}</label>
      <input
        id="display-name"
        value={displayName}
        maxLength={32}
        autoFocus
        onChange={(event) => setDisplayName(event.target.value)}
      />
      <button type="submit" disabled={!displayName.trim() || login.isPending}>
        {t('login.submit')}
      </button>
      {login.isError && (
        <p className="error" role="alert">
          {errorText(t, login.error)}
        </p>
      )}
    </form>
  );
}
