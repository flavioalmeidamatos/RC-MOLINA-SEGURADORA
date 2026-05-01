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
  created_at?: string;
  updated_at?: string;
}

export const getStoredSession = (): LocalAuthSession | null => {
  try {
    const rawSession = localStorage.getItem(LOCAL_AUTH_SESSION_KEY);
    if (!rawSession) {
      return null;
    }

    const session = JSON.parse(rawSession) as LocalAuthSession;
    if (!session?.user?.id || !session?.user?.email) {
      localStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
      return null;
    }

    return session;
  } catch (_error) {
    localStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
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

  localStorage.setItem(LOCAL_AUTH_SESSION_KEY, JSON.stringify(session));
  return session;
};

export const clearStoredSession = () => {
  localStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
};
