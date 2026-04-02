import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { AtualizarSenha } from './components/AtualizarSenha';
import { Cadastro } from './components/Cadastro';
import { Login } from './components/Login';
import { Preloader } from './components/Preloader';
import { RecuperarSenha } from './components/RecuperarSenha';
import { SCR_MENUPRINCIPAL } from './components/SCR_MENUPRINCIPAL';
import { isSupabaseConfigured, supabase, supabaseConfigError } from './lib/supabase';

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
  const [session, setSession] = useState<any>(null);
  const [perfil, setPerfil] = useState<any>(null);
  const [showPreloader, setShowPreloader] = useState(true);

  const fetchPerfil = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setPerfil(data);
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

    let isMounted = true;

    const syncSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();

        if (!isMounted) {
          return;
        }

        setSession(data.session);

        if (data.session?.user?.id) {
          await fetchPerfil(data.session.user.id);
        } else {
          setPerfil(null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Erro ao inicializar sessao:', error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (nextSession?.user?.id) {
        setLoading(true);
        fetchPerfil(nextSession.user.id);
      } else {
        setPerfil(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

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
        <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/cadastro" element={session ? <Navigate to="/dashboard" replace /> : <Cadastro />} />
        <Route path="/recuperar-senha" element={<RecuperarSenha />} />
        <Route path="/atualizar-senha" element={<AtualizarSenha />} />
        <Route
          path="/dashboard"
          element={
            session ? <SCR_MENUPRINCIPAL session={session} perfil={perfil} /> : <Navigate to="/login" replace />
          }
        />
        <Route path="/" element={<Navigate to={session ? '/dashboard' : '/login'} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
