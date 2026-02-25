import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Preloader } from './components/Preloader';
import { Login } from './components/Login';
import { Cadastro } from './components/Cadastro';
import { RecuperarSenha } from './components/RecuperarSenha';
import { AtualizarSenha } from './components/AtualizarSenha';
import { DebugDatabase } from './components/DebugDatabase';
import { supabase } from './lib/supabase';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    // Verifica sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Escuta mudanças na autenticação (login, logout, confirmação de e-mail)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <Preloader onComplete={() => {}} />;
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
          session ? (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#121212] text-white p-8">
              <h1 className="text-4xl font-bold mb-4 text-[#ccff00]">
                Bem-vindo, {session.user?.user_metadata?.full_name || session.user?.email}!
              </h1>
              <p className="text-gray-400 mb-8">Você está autenticado na RC Molina Seguradora.</p>
              <button 
                onClick={() => supabase.auth.signOut()}
                className="bg-red-600 px-6 py-2 rounded-lg font-bold hover:bg-red-700 transition"
              >
                Sair do Sistema
              </button>
            </div>
          ) : (
            <Navigate to="/login" replace />
          )
        } />
        <Route path="/" element={<Navigate to={session ? "/dashboard" : "/login"} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
