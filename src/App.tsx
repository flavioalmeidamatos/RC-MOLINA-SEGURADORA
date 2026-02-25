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
    // Verifica sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) {
        fetchPerfil(session.user.id);
      } else {
        setLoading(false);
      }
    });

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
                Bem-vindo, {perfil?.nome_completo || session.user?.email}!
              </h1>
              {perfil && (
                <div className="bg-[#1a1a1a] p-6 rounded-xl border border-gray-800 w-full max-w-lg mb-8 space-y-3">
                  <h2 className="text-xl font-bold mb-4 border-b border-gray-800 pb-2">Seus Dados</h2>
                  <p><span className="text-gray-500">Nome:</span> {perfil.nome_completo}</p>
                  <p><span className="text-gray-500">E-mail:</span> {perfil.email}</p>
                  <p><span className="text-gray-500">Organização:</span> {perfil.organizacao || 'Não informada'}</p>
                  <p><span className="text-gray-500">Membro desde:</span> {new Date(perfil.criado_em).toLocaleDateString('pt-BR')}</p>
                </div>
              )}
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
