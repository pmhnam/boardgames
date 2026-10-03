import type { AuthSessionDto, GuestLoginRequest } from '@bgp/shared-types';
import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '../../shared/api/http';
import { useAuthStore } from './auth.store';

export function GuestLoginForm() {
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
      <h1>Play as guest</h1>
      <label htmlFor="display-name">Display name</label>
      <input
        id="display-name"
        value={displayName}
        maxLength={32}
        autoFocus
        onChange={(event) => setDisplayName(event.target.value)}
      />
      <button type="submit" disabled={!displayName.trim() || login.isPending}>
        Continue
      </button>
      {login.isError && <p className="error">{errorMessage(login.error)}</p>}
    </form>
  );
}
