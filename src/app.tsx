import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { AtualizarSenha } from './components/auth/atualizar_senha';
import { Cadastro } from './components/auth/cadastro';
import { Login } from './components/auth/login';
import { Preloader } from './components/shared/preloader';
import { RecuperarSenha } from './components/auth/recuperar_senha';
import { SCR_MENUPRINCIPAL } from './components/dashboard/rc_menu_principal';
import { clearStoredSession, getStoredSession, storeSession, type LocalAuthSession, type UsuarioPerfil } from './lib/local_auth';
import { apiGetProfile } from './lib/local_api';

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

export default function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<LocalAuthSession | null>(null);
  const [perfil, setPerfil] = useState<UsuarioPerfil | null>(null);
  const [showPreloader, setShowPreloader] = useState(true);

  const fetchPerfil = async (userId: string) => {
    try {
      const result = await withTimeout(
        apiGetProfile(userId),
        PROFILE_BOOT_TIMEOUT_MS,
      );

      if (!result) {
        setPerfil(null);
        return;
      }

      const { data, error } = result;

      if (!error && data) {
        setPerfil(data);
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
