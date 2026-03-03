import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Preloader } from './components/Preloader';
import { Login } from './components/Login';
import { Cadastro } from './components/Cadastro';
import { RecuperarSenha } from './components/RecuperarSenha';
import { AtualizarSenha } from './components/AtualizarSenha';
import { DebugDatabase } from './components/DebugDatabase';
import { SCR_MENUPRINCIPAL } from './components/SCR_MENUPRINCIPAL';
import { supabase } from './lib/supabase';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [perfil, setPerfil] = useState<any>(null);

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
    // Força o logout logo na inicialização para garantir que uma nova sessão seja sempre exigida
    const forceNewSession = async () => {
      await supabase.auth.signOut();
      setSession(null);
      setPerfil(null);
      setLoading(false);
    };

    forceNewSession();

    // Escuta mudanças na autenticação (login, logout, confirmação de e-mail)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) {
        setLoading(true);
        fetchPerfil(session.user.id);
      } else {
        setPerfil(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const [showPreloader, setShowPreloader] = useState(true);

  if (showPreloader) {
    return <Preloader onComplete={() => setShowPreloader(false)} />;
  }

  if (loading) {
    return <div className="min-h-screen bg-[#121212]" />; // Tela escura rápida caso Supabase ainda esteja carregando
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/cadastro" element={session ? <Navigate to="/dashboard" replace /> : <Cadastro />} />
        <Route path="/recuperar-senha" element={<RecuperarSenha />} />
        <Route path="/atualizar-senha" element={<AtualizarSenha />} />
        <Route path="/debug-db" element={<DebugDatabase />} />
        <Route path="/dashboard" element={
          session ? <SCR_MENUPRINCIPAL session={session} perfil={perfil} /> : <Navigate to="/login" replace />
        } />
        <Route path="/" element={<Navigate to={session ? "/dashboard" : "/login"} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
