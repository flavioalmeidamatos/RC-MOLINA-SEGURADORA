export const LOCAL_AUTH_SESSION_KEY = 'rcmolina_usuario_session';

export interface LocalAuthSession {
  user: {
    id: string;
    email: string;
  };
}

export interface UsuarioPerfil {
  id: string;
  email: string;
  nome_completo: string;
  organizacao?: string | null;
  avatar_url?: string | null;
  logo_url?: string | null;
  permissoes?: Record<string, boolean> | null;
  aprovado?: boolean;
  is_master_admin?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const MASTER_EMAILS = [
  'admin@rcmolina.com.br',
  'matos.almeida.flavio@gmail.com'
];

export const isMasterAdmin = (userOrEmail: { email?: string; is_master_admin?: boolean } | string | null | undefined): boolean => {
  if (!userOrEmail) return false;
  if (typeof userOrEmail === 'string') {
    return MASTER_EMAILS.includes(userOrEmail.toLowerCase().trim());
  }
  if (userOrEmail.is_master_admin === true) return true;
  if (userOrEmail.email && MASTER_EMAILS.includes(userOrEmail.email.toLowerCase().trim())) return true;
  return false;
};

export const getStoredSession = (): LocalAuthSession | null => {
  try {
    const rawSession = sessionStorage.getItem(LOCAL_AUTH_SESSION_KEY);
    if (!rawSession) {
      return null;
    }

    const session = JSON.parse(rawSession) as LocalAuthSession;
    if (!session?.user?.id || !session?.user?.email) {
      sessionStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
      return null;
    }

    return session;
  } catch (_error) {
    sessionStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
    return null;
  }
};

export const storeSession = (perfil: UsuarioPerfil): LocalAuthSession => {
  const session = {
    user: {
      id: perfil.id,
      email: perfil.email,
    },
  };

  sessionStorage.setItem(LOCAL_AUTH_SESSION_KEY, JSON.stringify(session));
  return session;
};

export const clearStoredSession = () => {
  sessionStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
};
