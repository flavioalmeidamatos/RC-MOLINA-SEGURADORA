import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { validarEmailRFC5322, traduzirErroSupabase } from '../lib/validacoes';

export const RecuperarSenha: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' }); // tipo: 'sucesso' ou 'erro'
  const [carregando, setCarregando] = useState(false);

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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagem({ texto: '', tipo: '' });

    if (!validarEmailRFC5322(email)) {
      setMensagem({ texto: 'Por favor, insira um e-mail válido.', tipo: 'erro' });
      return;
    }

    setCarregando(true);

    try {
      const { data: perfilData, error: perfilError } = await supabase
        .from('perfis')
        .select('id')
        .eq('email', email)
        .single();

      if (perfilError || !perfilData) {
        setMensagem({ texto: 'Este e-mail não foi encontrado em nossa base de dados.', tipo: 'erro' });
        setCarregando(false);
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/atualizar-senha`,
      });

      if (error) {
        setMensagem({
          tipo: 'erro',
          texto: 'Erro ao enviar o e-mail: ' + traduzirErroSupabase(error.message)
        });
      } else {
        setMensagem({ texto: 'Um e-mail será enviado para redefinição de senha.', tipo: 'sucesso' });
        await supabase.from('auditoria').insert([{ perfil_id: perfilData.id, acao: 'SOLICITAR_RESET_SENHA', detalhes: { email } }]);
      }
    } catch (err) {
      console.error(err);
      setMensagem({ texto: 'Ocorreu um erro inesperado.', tipo: 'erro' });
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div id="SCR-004" data-name="recriasenha" className="flex flex-col items-center justify-center min-h-screen bg-[#121212] text-white p-4">
      <div className="w-full max-w-md bg-[#1a1a1a] p-8 rounded-2xl shadow-2xl border border-gray-800">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-black px-6 py-3 rounded mb-6">
            <div className="text-[#d4af37] font-serif text-xl tracking-widest font-bold">RC MOLINA</div>
            <div className="text-white text-[10px] tracking-[0.3em] text-center">CORRETORA</div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Recuperar Senha</h1>
          <p className="text-gray-400 text-sm">Informe seu e-mail para receber as instruções.</p>
        </div>

        {mensagem.texto && (
          <div className={`p-4 rounded-xl mb-6 text-sm text-center ${mensagem.tipo === 'sucesso' ? 'bg-green-900/10 border border-green-500 text-green-200' : 'bg-red-900/10 border border-red-500 text-red-200'}`}>
            {mensagem.texto}
          </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-6">
          <div>
            <label className="block text-sm font-bold mb-2">E-mail Cadastrado</label>
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

          <button
            type="submit"
            disabled={carregando || mensagem.tipo === 'sucesso'}
            className="w-full bg-[#ccff00] text-black font-black text-lg rounded-xl p-4 hover:bg-[#b3e600] transition flex justify-center items-center gap-2 mt-4"
          >
            {carregando ? 'Aguarde...' : 'Enviar link de recuperação ->'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-8">
          Lembrou a senha? <button onClick={() => navigate('/login')} className="text-[#ccff00] font-bold hover:underline">Voltar ao Login</button>
        </p>

        <div className="mt-12 text-center text-sm text-gray-500 font-black">
          CKDEV Soluções em TI – (21) 98868-1799
        </div>
      </div>
    </div>
  );
};
