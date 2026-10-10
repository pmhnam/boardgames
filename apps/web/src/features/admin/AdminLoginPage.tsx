import type { AdminLoginRequest, AuthSessionDto } from '@bgp/shared-types';
import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../../shared/api/http';
import { errorText } from '../../shared/i18n/errors';
import { useT } from '../../shared/i18n/useT';
import { useAuthStore } from '../auth/auth.store';
import { isAdmin } from '../auth/roles';

export function AdminLoginPage() {
  const t = useT();
  const navigate = useNavigate();
  const session = useAuthStore((state) => state.session);
  const setSession = useAuthStore((state) => state.setSession);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: (body: AdminLoginRequest) => api<AuthSessionDto>('POST', '/auth/admin/login', body),
    onSuccess: (next) => {
      setSession(next);
      navigate('/admin', { replace: true });
    },
  });

  if (isAdmin(session)) return <Navigate to="/admin" replace />;

  const ready = username.trim() !== '' && password !== '';
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (ready) login.mutate({ username: username.trim(), password });
  };

  return (
    <form className="card narrow" onSubmit={submit}>
      <h1>{t('adminLogin.title')}</h1>
      <p className="muted login-intro">{t('adminLogin.intro')}</p>
      {session && (
        <p className="muted login-intro">
          {t('adminLogin.replaces', { name: session.user.displayName })}
        </p>
      )}
      <label htmlFor="admin-username">{t('adminLogin.username')}</label>
      <input
        id="admin-username"
        value={username}
        maxLength={32}
        autoComplete="username"
        autoFocus
        onChange={(event) => setUsername(event.target.value)}
      />
      <label htmlFor="admin-password">{t('adminLogin.password')}</label>
      <input
        id="admin-password"
        type="password"
        value={password}
        maxLength={256}
        autoComplete="current-password"
        onChange={(event) => setPassword(event.target.value)}
      />
      <button type="submit" disabled={!ready || login.isPending}>
        {login.isPending ? t('adminLogin.pending') : t('adminLogin.submit')}
      </button>
      {login.isError && (
        <p className="error" role="alert">
          {errorText(t, login.error)}
        </p>
      )}
    </form>
  );
}
