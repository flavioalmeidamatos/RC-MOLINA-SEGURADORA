import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { apiAudit, apiResetPassword } from '../../lib/local_api';
import { validarEmailRFC5322 } from '../../lib/validacoes';
import { FooterAdmin } from '../shared/footer_admin';

type Stage = 'email' | 'otp' | 'password';

export const RecuperarSenha: React.FC = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' });
  const [carregando, setCarregando] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [success, setSuccess] = useState(false);

  // Persistir cooldown no localStorage
  useEffect(() => {
    const savedTime = localStorage.getItem('rcmolina_reset_cooldown');
    if (savedTime) {
      const elapsed = Math.floor((Date.now() - parseInt(savedTime)) / 1000);
      const remaining = 60 - elapsed;
      if (remaining > 0) {
        setCooldown(remaining);
      } else {
        localStorage.removeItem('rcmolina_reset_cooldown');
      }
    }
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            localStorage.removeItem('rcmolina_reset_cooldown');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSetCooldown = () => {
    setCooldown(60);
    localStorage.setItem('rcmolina_reset_cooldown', Date.now().toString());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const form = e.currentTarget.form;
      if (form) {
        const elements = Array.from(form.elements).filter((el) => {
          const element = el as HTMLElement;
          return (
            element.tagName === 'INPUT' ||
            (element.tagName === 'BUTTON' && (element as HTMLButtonElement).type === 'submit')
          );
        }) as HTMLElement[];
        const index = elements.indexOf(e.currentTarget);
        if (index > -1 && index < elements.length - 1) {
          e.preventDefault();
          elements[index + 1].focus();
        }
      }
    }
  };

  /* ── Etapa 1: Solicitar código OTP ──────────────────────────────── */
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagem({ texto: '', tipo: '' });

    if (cooldown > 0) return;

    if (!validarEmailRFC5322(email)) {
      setMensagem({ texto: 'Por favor, insira um e-mail válido.', tipo: 'erro' });
      return;
    }

    setCarregando(true);

    try {
      const response = await fetch('/api/send-login-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const payload = await response.json().catch(() => ({}));

      if (response.status === 429) {
        setMensagem({ texto: payload.error || 'Aguarde 60 segundos entre solicitacoes.', tipo: 'erro' });
      } else if (!response.ok && response.status !== 200) {
        setMensagem({ texto: payload.error || 'Não foi possível enviar o código seguro.', tipo: 'erro' });
      } else {
        setMensagem({
          texto: 'Se este e-mail estiver cadastrado, você receberá o código de verificação.',
          tipo: 'sucesso',
        });
        setStage('otp');
        handleSetCooldown();

        apiAudit('SOLICITAR_RESET_SENHA', { email: email.trim().toLowerCase() });
      }
    } catch (err) {
      console.error(err);
      setMensagem({ texto: 'Ocorreu um erro inesperado.', tipo: 'erro' });
    } finally {
      setCarregando(false);
    }
  };

  /* ── Etapa 2 + 3: Verificar OTP e salvar nova senha atomicamente ── */
  const handleResetWithOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagem({ texto: '', tipo: '' });

    if (otpCode.length !== 6) {
      setMensagem({ texto: 'O código deve conter 6 dígitos.', tipo: 'erro' });
      return;
    }

    if (stage === 'otp') {
      // Avança para a etapa de senha
      setStage('password');
      return;
    }

    // stage === 'password' — validar senha e enviar tudo
    if (password.length < 8) {
      setMensagem({ texto: 'A senha deve ter pelo menos 8 caracteres.', tipo: 'erro' });
      return;
    }

    const regexSenhaForte = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!regexSenhaForte.test(password)) {
      setMensagem({
        texto: 'A senha deve conter letras maiusculas, minusculas, numeros e caracteres especiais (@$!%*?&).',
        tipo: 'erro',
      });
      return;
    }

    if (password !== confirmPassword) {
      setMensagem({ texto: 'As senhas não coincidem.', tipo: 'erro' });
      return;
    }

    setCarregando(true);

    try {
      const { data, error } = await apiResetPassword({
        email: email.trim().toLowerCase(),
        codigo: otpCode,
        nova_senha: password,
      });

      if (error) {
        setMensagem({ texto: error || 'Erro ao redefinir senha.', tipo: 'erro' });
        setCarregando(false);
        return;
      }

      const result = data as { status: string; message: string; remaining?: number } | null;

      if (!result || result.status !== 'SUCCESS') {
        // Melhoria #3: Feedback diferenciado por tipo de erro
        let textoErro = 'Código inválido ou expirado.';
        if (result?.status === 'BLOCKED') {
          textoErro = 'Código bloqueado por excesso de tentativas. Solicite um novo código.';
        } else if (result?.status === 'EXPIRED') {
          textoErro = 'Código expirado. Solicite um novo código.';
        } else if (result?.status === 'INVALID') {
          const restantes = result?.remaining ?? 0;
          textoErro = restantes > 0
            ? `Codigo incorreto. Voce tem mais ${restantes} tentativa${restantes > 1 ? 's' : ''}.`
            : 'Código incorreto. Esta é a última tentativa.';
        }

        setMensagem({ texto: textoErro, tipo: 'erro' });

        // Se bloqueado ou expirado, voltar para solicitar novo código
        if (result?.status === 'BLOCKED' || result?.status === 'EXPIRED') {
          setOtpCode('');
          setStage('otp');
        }

        setCarregando(false);
        return;
      }

      // Sucesso!
      setSuccess(true);
      setMensagem({ texto: 'Senha atualizada com sucesso! Redirecionando para o login...', tipo: 'sucesso' });
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      console.error(err);
      setMensagem({ texto: 'Ocorreu um erro inesperado.', tipo: 'erro' });
    } finally {
      setCarregando(false);
    }
  };

  /* ── Subtítulos por etapa ───────────────────────────────────────── */
  const subtitles: Record<Stage, string> = {
    email: 'Informe seu e-mail para receber o código de verificação.',
    otp: 'Digite o código de 6 dígitos enviado para o seu e-mail.',
    password: 'Crie uma nova senha segura para sua conta.',
  };

  const stepLabels: Record<Stage, string> = {
    email: 'Etapa 1 de 3',
    otp: 'Etapa 2 de 3',
    password: 'Etapa 3 de 3',
  };

  return (
    <div
      id="SCR-004"
      data-name="recriasenha"
      className="flex flex-col items-center justify-center min-h-screen bg-[#121212] text-white p-4"
    >
      <div className="w-full max-w-md bg-[#1a1a1a] p-8 rounded-2xl shadow-2xl border border-gray-800">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-black px-6 py-3 rounded mb-6">
            <div className="text-[#d4af37] font-serif text-xl tracking-widest font-bold">RC MOLINA</div>
            <div className="text-white text-[10px] tracking-[0.3em] text-center">CORRETORA</div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Recuperar Senha</h1>
          <p className="text-gray-400 text-sm text-center">{subtitles[stage]}</p>
          <div className="mt-3 flex items-center gap-2">
            {(['email', 'otp', 'password'] as Stage[]).map((s) => (
              <div
                key={s}
                className={`h-1.5 w-12 rounded-full transition-all duration-300 ${
                  s === stage
                    ? 'bg-[#ccff00]'
                    : (['email', 'otp', 'password'].indexOf(s) < ['email', 'otp', 'password'].indexOf(stage))
                      ? 'bg-[#ccff00]/40'
                      : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
          <p className="text-gray-500 text-xs mt-2">{stepLabels[stage]}</p>
        </div>

        {mensagem.texto && (
          <div
            className={`p-4 rounded-xl mb-6 text-sm text-center ${
              mensagem.tipo === 'sucesso'
                ? 'bg-green-900/10 border border-green-500 text-green-200'
                : 'bg-red-900/10 border border-red-500 text-red-200'
            }`}
          >
            {mensagem.texto}
          </div>
        )}

        {/* ── Etapa 1: E-mail ────────────────────────────────────────── */}
        {stage === 'email' && (
          <form onSubmit={handleRequestOtp} className="space-y-6">
            <div>
              <label className="block text-sm font-bold mb-2">E-mail Cadastrado</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={cooldown > 0}
                placeholder="você@exemplo.com"
                className="w-full bg-[#121212] border border-gray-700 rounded-xl p-4 focus:outline-none focus:border-[#ccff00] transition disabled:opacity-50 disabled:cursor-not-allowed"
                required
              />
            </div>

            <button
              type="submit"
              disabled={carregando || cooldown > 0}
              className="w-full bg-[#ccff00] text-black font-black text-lg rounded-xl p-4 hover:bg-[#b3e600] transition flex justify-center items-center gap-2 mt-4 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {carregando
                ? 'Aguarde...'
                : cooldown > 0
                  ? `Aguarde ${cooldown}s para reenviar`
                  : 'Enviar Código de Verificação ->'}
            </button>
          </form>
        )}

        {/* ── Etapa 2: Código OTP ────────────────────────────────────── */}
        {stage === 'otp' && (
          <form onSubmit={handleResetWithOtp} className="space-y-6">
            <div className="mb-2 rounded-xl border border-green-500 bg-green-900/10 p-4 text-sm text-green-200">
              Enviamos um codigo para <strong>{email}</strong>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">Código de Verificação</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full bg-[#121212] border border-gray-700 rounded-xl p-4 text-center text-2xl tracking-[0.5em] focus:outline-none focus:border-[#ccff00] transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={carregando || otpCode.length < 6}
              className="w-full bg-[#ccff00] text-black font-black text-lg rounded-xl p-4 hover:bg-[#b3e600] transition flex justify-center items-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {carregando ? 'Verificando...' : 'Verificar Código ->'}
            </button>

            <div className="flex justify-between items-center mt-2">
              <button
                type="button"
                onClick={() => {
                  setOtpCode('');
                  setStage('email');
                  setMensagem({ texto: '', tipo: '' });
                }}
                className="text-sm text-gray-500 hover:text-white"
              >
                ← Corrigir E-mail
              </button>
              <button
                type="button"
                disabled={cooldown > 0}
                onClick={() => {
                  setOtpCode('');
                  setMensagem({ texto: '', tipo: '' });
                  handleRequestOtp({ preventDefault: () => {} } as React.FormEvent);
                }}
                className="text-sm text-gray-500 hover:text-[#ccff00] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {cooldown > 0 ? `Reenviar (${cooldown}s)` : 'Reenviar código'}
              </button>
            </div>
          </form>
        )}

        {/* ── Etapa 3: Nova Senha ────────────────────────────────────── */}
        {stage === 'password' && (
          <form onSubmit={handleResetWithOtp} className="space-y-6">
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
              <p className="text-gray-500 text-xs mt-2">
                Minimo 8 caracteres com maiusculas, minusculas, numeros e especiais (@$!%*?&)
              </p>
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
              disabled={carregando || success}
              className="w-full bg-[#ccff00] text-black font-black text-lg rounded-xl p-4 hover:bg-[#b3e600] transition flex justify-center items-center gap-2 mt-4 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {carregando ? 'Salvando...' : 'Salvar Nova Senha ->'}
            </button>

            <button
              type="button"
              onClick={() => {
                setPassword('');
                setConfirmPassword('');
                setStage('otp');
                setMensagem({ texto: '', tipo: '' });
              }}
              className="w-full text-sm text-gray-500 hover:text-white mt-2"
            >
              ← Voltar para o codigo
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-400 mt-8">
          Lembrou a senha?{' '}
          <button onClick={() => navigate('/login')} className="text-[#ccff00] font-bold hover:underline">
            Voltar ao Login
          </button>
        </p>

        <FooterAdmin />
      </div>
    </div>
  );
};
