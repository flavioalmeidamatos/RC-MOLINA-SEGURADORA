import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * AtualizarSenha — Rota protegida.
 *
 * Após a correção de segurança, esta rota NÃO permite mais alteração
 * direta de senha. O fluxo correto agora é:
 *   /recuperar-senha → OTP por e-mail → verificação → nova senha (atômico)
 *
 * Esta página apenas redireciona para /recuperar-senha.
 */
export const AtualizarSenha: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redireciona imediatamente para o fluxo seguro com OTP
    navigate('/recuperar-senha', { replace: true });
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#121212] text-white p-4">
      <div className="w-full max-w-md bg-[#1a1a1a] p-8 rounded-2xl shadow-2xl border border-gray-800 text-center">
        <div className="bg-black px-6 py-3 rounded mb-6 inline-block">
          <div className="text-[#d4af37] font-serif text-xl tracking-widest font-bold">RC MOLINA</div>
          <div className="text-white text-[10px] tracking-[0.3em] text-center">CORRETORA</div>
        </div>
        <p className="text-gray-400 text-sm">Redirecionando para recuperacao segura...</p>
      </div>
    </div>
  );
};
