import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { validarEmailRFC5322 } from '../lib/validacoes';
import { FooterAdmin } from './FooterAdmin';

export const AtualizarSenha: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialEmail = ((location.state as any)?.email || '').toString();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const form = e.currentTarget.form;
      if (form) {
        const elements = Array.from(form.elements).filter(
          (el) => {
            const element = el as HTMLElement;
            return element.tagName === 'INPUT' || (element.tagName === 'BUTTON' && (element as HTMLButtonElement).type === 'submit');
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

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    // Validação de complexidade de senha
    const regexSenhaForte = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!regexSenhaForte.test(password)) {
      setError('A senha deve conter pelo menos 8 caracteres, incluindo letras maiúsculas, minúsculas, números e caracteres especiais.');
      return;
    }

    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();

    if (!validarEmailRFC5322(normalizedEmail)) {
      setError('Informe um e-mail valido para atualizar a senha.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.rpc('usuarios_atualizar_senha', {
      p_email: normalizedEmail,
      p_senha: password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#121212] text-white p-4">
      <div className="w-full max-w-md bg-[#1a1a1a] p-8 rounded-2xl shadow-2xl border border-gray-800">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-black px-6 py-3 rounded mb-6">
            <div className="text-[#d4af37] font-serif text-xl tracking-widest font-bold">RC MOLINA</div>
            <div className="text-white text-[10px] tracking-[0.3em] text-center">CORRETORA</div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Redefinir Senha</h1>
          <p className="text-gray-400 text-sm">Crie uma nova senha para sua conta</p>
        </div>

        {error && (
          <div className="bg-red-900/10 border border-red-500 text-red-200 p-4 rounded-xl mb-6 text-sm text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-900/10 border border-green-500 text-green-200 p-4 rounded-xl mb-6 text-sm text-center">
            Senha atualizada com sucesso! Redirecionando...
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-6">
          <div>
            <label className="block text-sm font-bold mb-2">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="voce@exemplo.com"
              className="w-full bg-[#121212] border border-gray-700 rounded-xl p-4 focus:outline-none focus:border-[#ccff00] transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Nova Senha</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pelo menos 8 caracteres"
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

          <div>
            <label className="block text-sm font-bold mb-2">Confirme a Nova Senha</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite novamente sua senha"
                className="w-full bg-[#121212] border border-gray-700 rounded-xl p-4 pr-12 focus:outline-none focus:border-[#ccff00] transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full bg-[#ccff00] text-black font-black text-lg rounded-xl p-4 hover:bg-[#b3e600] transition flex justify-center items-center gap-2 mt-4"
          >
            {loading ? 'Aguarde...' : 'Salvar Nova Senha ->'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-8">
          Lembrou a senha? <button onClick={() => navigate('/login')} className="text-[#ccff00] font-bold hover:underline">Voltar ao Login</button>
        </p>

        <FooterAdmin />
      </div>
    </div>
  );
};
