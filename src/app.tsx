import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { AtualizarSenha } from './components/auth/atualizar_senha';
import { Cadastro } from './components/auth/cadastro';
import { Login } from './components/auth/login';
import { Preloader } from './components/shared/preloader';
import { RecuperarSenha } from './components/auth/recuperar_senha';
import { SCR_MENUPRINCIPAL } from './components/dashboard/rc_menu_principal';
import { clearStoredSession, getStoredSession, storeSession, type LocalAuthSession, type UsuarioPerfil } from './lib/local_auth';
import { isSupabaseConfigured, supabase, supabaseConfigError } from './lib/supabase';

const PROFILE_BOOT_TIMEOUT_MS = 3500;

const withTimeout = async <T,>(promise: PromiseLike<T>, timeoutMs: number): Promise<T | null> => {
  let timeoutId: number | undefined;

  const timeout = new Promise<null>((resolve) => {
    timeoutId = window.setTimeout(() => resolve(null), timeoutMs);
  });

  const result = await Promise.race([promise, timeout]);

  if (timeoutId) {
    window.clearTimeout(timeoutId);
  }

  return result;
};

function ConfigErrorScreen() {
  return (
    <main className="min-h-screen bg-[#121212] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg items-center justify-center">
        <section className="w-full rounded-3xl border border-red-500/30 bg-[#1a1a1a] p-6 shadow-2xl sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-300">Falha de configuracao</p>
          <h1 className="mt-4 text-2xl font-bold sm:text-3xl">O sistema nao conseguiu iniciar.</h1>
          <p className="mt-4 text-sm leading-6 text-gray-300 sm:text-base">{supabaseConfigError}</p>
          <p className="mt-4 text-sm leading-6 text-gray-400 sm:text-base">
            Configure essas variaveis no ambiente onde o site esta rodando e recarregue a pagina.
          </p>
        </section>
      </div>
    </main>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<LocalAuthSession | null>(null);
  const [perfil, setPerfil] = useState<UsuarioPerfil | null>(null);
  const [showPreloader, setShowPreloader] = useState(true);

  const fetchPerfil = async (userId: string) => {
    try {
      const result = await withTimeout(
        supabase.rpc('usuarios_perfil', {
          p_id: userId,
        }),
        PROFILE_BOOT_TIMEOUT_MS,
      );

      if (!result) {
        setPerfil(null);
        return;
      }

      const { data, error } = result;
      const perfilData = Array.isArray(data) ? data[0] : null;

      if (!error && perfilData) {
        setPerfil(perfilData);
      } else {
        clearStoredSession();
        setSession(null);
        setPerfil(null);
      }
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    const syncSession = async () => {
      const storedSession = getStoredSession();

      if (!storedSession) {
        setSession(null);
        setPerfil(null);
        setLoading(false);
        return;
      }

      setSession(storedSession);
      await fetchPerfil(storedSession.user.id);
    };

    syncSession();
  }, []);

  const handleLogin = (nextPerfil: UsuarioPerfil) => {
    const nextSession = storeSession(nextPerfil);
    setSession(nextSession);
    setPerfil(nextPerfil);
  };

  const handleLogout = () => {
    clearStoredSession();
    setSession(null);
    setPerfil(null);
  };

  if (showPreloader) {
    return <Preloader onComplete={() => setShowPreloader(false)} />;
  }

  if (loading) {
    return <div className="min-h-screen bg-[#121212]" />;
  }

  if (!isSupabaseConfigured) {
    return <ConfigErrorScreen />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLogin} />} />
        <Route path="/cadastro" element={session ? <Navigate to="/dashboard" replace /> : <Cadastro />} />
        <Route path="/recuperar-senha" element={<RecuperarSenha />} />
        <Route path="/atualizar-senha" element={<AtualizarSenha />} />
        <Route
          path="/dashboard"
          element={
            session ? (
              <SCR_MENUPRINCIPAL session={session} perfil={perfil} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="/" element={<Navigate to={session ? '/dashboard' : '/login'} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
