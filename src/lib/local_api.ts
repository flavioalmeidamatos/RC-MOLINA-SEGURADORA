import type { UsuarioPerfil } from './local_auth';

type ApiResult<T> = {
  data?: T;
  error?: string;
};

const parseJson = async <T>(response: Response): Promise<ApiResult<T>> => {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { error: payload?.error || 'Nao foi possivel concluir a operacao.' };
  }

  return { data: payload?.data ?? payload };
};

export const apiGetProfile = async (id: string) => {
  const response = await fetch(`/api/auth/profile/${encodeURIComponent(id)}`);
  return parseJson<UsuarioPerfil>(response);
};

export const apiEmailExists = async (email: string) => {
  const response = await fetch('/api/auth/email-exists', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return parseJson<boolean>(response);
};

export const apiLogin = async (email: string, senha: string) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  });
  return parseJson<UsuarioPerfil>(response);
};

export const apiRegister = async (payload: {
  email: string;
  senha: string;
  nome_completo: string;
  organizacao?: string;
  avatar_data_url?: string | null;
  avatar_file_name?: string | null;
}) => {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson<UsuarioPerfil>(response);
};

export const apiVerifyCode = async (email: string, codigo: string) => {
  const response = await fetch('/api/auth/verify-code', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, codigo }),
  });
  return parseJson<UsuarioPerfil>(response);
};

export const apiResetPassword = async (payload: { email: string; codigo: string; nova_senha: string }) => {
  const response = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson<{ status: string; message: string; remaining?: number }>(response);
};

export const apiAudit = async (acao: string, detalhes: Record<string, unknown>) => {
  await fetch('/api/audit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ acao, detalhes }),
  }).catch(() => undefined);
};

export const apiAdminLogin = async (email: string, senha: string) => {
  const response = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  });
  return parseJson<{ token: string; data: UsuarioPerfil }>(response);
};

export const apiAdminListUsers = async (token: string) => {
  const response = await fetch('/api/admin/users', {
    headers: { authorization: `Bearer ${token}` },
  });
  return parseJson<UsuarioPerfil[]>(response);
};

export const apiAdminUpdateUser = async (
  token: string,
  id: string,
  payload: {
    nome: string;
    email: string;
    organizacao?: string;
    avatar_url?: string | null;
    avatar_data_url?: string | null;
    avatar_file_name?: string | null;
  },
) => {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return parseJson<{ ok: boolean }>(response);
};

export const apiAdminDeleteUser = async (token: string, id: string) => {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  });
  return parseJson<{ ok: boolean }>(response);
};
