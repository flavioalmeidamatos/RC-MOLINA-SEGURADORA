import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { validarEmailRFC5322 } from '../lib/validacoes';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const form = e.currentTarget.form;
      if (form) {
        const elements = Array.from(form.elements).filter(
          (el) => {
            const element = el as HTMLElement;
            return element.tagName === 'INPUT' && (element as HTMLInputElement).type !== 'file';
          }
        ) as HTMLElement[];
        
        const index = elements.indexOf(e.currentTarget);
        if (index > -1 && index < elements.length - 1) {
          e.preventDefault();
          const nextElement = elements[index + 1];
          nextElement.focus();
        }
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const normalizedEmail = email.trim().toLowerCase();

    // Validação de E-mail RFC 5322
    if (!validarEmailRFC5322(normalizedEmail)) {
      setError('Por favor, insira um e-mail em formato válido.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      console.error('Erro de login:', error.message);
      
      // Se o erro for de confirmação de e-mail
      if (error.message.includes('Email not confirmed')) {
        setError('Por favor, confirme seu e-mail antes de acessar.');
        setLoading(false);
        return;
      }

      // Tenta verificar se o usuário existe na nossa tabela de perfis
      const { data: profile, error: profileError } = await supabase
        .from('perfis')
        .select('email')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (profileError) console.warn('Erro ao consultar perfis:', profileError.message);

      if (profile) {
        // Se o perfil existe, o erro com certeza é a senha
        setError('Senha incorreta. Verifique sua senha ou use "Esqueceu sua senha?".');
      } else {
        // Se não encontrou no perfil, pode ser que não exista
        setError('E-mail não cadastrado ou senha incorreta.');
      }
      
      setLoading(false);
      // Devolve o foco para o campo de senha e seleciona o texto
      setTimeout(() => {
        if (passwordInputRef.current) {
          passwordInputRef.current.focus();
          passwordInputRef.current.select();
        }
      }, 50);
    } else {
      alert('Usuário logado');
      navigate('/dashboard');
    }
  };

  const handleGoogleLogin = () => {
    // Apenas visual, lógica removida conforme solicitado
    setError('O login com Google está temporariamente indisponível.');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#121212] text-white p-4">
      <div className="w-full max-w-md bg-[#1a1a1a] p-8 rounded-2xl shadow-2xl border border-gray-800">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-black px-6 py-3 rounded mb-6">
            <div className="text-[#d4af37] font-serif text-xl tracking-widest font-bold">RC MOLINA</div>
            <div className="text-white text-[10px] tracking-[0.3em] text-center">CORRETORA</div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Bem vindo de volta</h1>
          <p className="text-gray-400 text-sm">Inicie sessão na sua conta para continuar.</p>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-[#121212] border border-gray-700 rounded-xl p-3 mb-8 hover:bg-gray-800 transition"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          <span className="font-semibold">Iniciar sessão com o Google</span>
        </button>

        <div className="relative flex items-center justify-center mb-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-700"></div>
          </div>
          <span className="relative px-4 bg-[#1a1a1a] text-xs text-gray-500 uppercase tracking-widest font-bold">ou continue por e-mail</span>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500 text-red-200 p-3 rounded-lg mb-6 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-bold mb-2">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="você@exemplo.com"
              className="w-full bg-[#121212] border border-gray-700 rounded-xl p-4 focus:outline-none focus:border-[#ccff00] transition"
              required
            />
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-bold">Senha</label>
              <button
                type="button"
                onClick={() => navigate('/recuperar-senha')}
                className="text-xs text-gray-500 hover:text-[#ccff00]"
              >
                Esqueceu sua senha?
              </button>
            </div>
            <div className="relative">
              <input
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua senha"
                className="w-full bg-[#121212] border border-gray-700 rounded-xl p-4 pr-12 focus:outline-none focus:border-[#ccff00] transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#ccff00] text-black font-black text-lg rounded-xl p-4 hover:bg-[#b3e600] transition flex justify-center items-center gap-2"
          >
            {loading ? 'Aguarde...' : 'Entrar ->'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-8">
          Ainda não tem conta? <button onClick={() => navigate('/cadastro')} className="text-[#ccff00] font-bold hover:underline">Cadastre-se</button>
        </p>

        <div className="mt-12 text-center text-sm text-gray-500 font-black">
          CKDEV Soluções em TI – (21) 98868-1799
        </div>
      </div>
    </div>
  );
};
