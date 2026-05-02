import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, Mail } from 'lucide-react';
import type { UsuarioPerfil } from '../../lib/local_auth';
import { supabase } from '../../lib/supabase';
import { validarEmailRFC5322 } from '../../lib/validacoes';
import { FooterAdmin } from '../shared/footer_admin';

interface LoginProps {
  embedded?: boolean;
  onLogin?: (perfil: UsuarioPerfil) => void;
}

export const Login: React.FC<LoginProps> = ({ embedded = false, onLogin }) => {
  const navigate = useNavigate();
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
  const [otpStage, setOtpStage] = useState<'request' | 'verify'>('request');
  const [otpCode, setOtpCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const heading = 'Bem vindo de volta';
  const subtitle = loginMethod === 'password'
    ? 'Inicie sessao na sua conta para continuar.'
    : 'Acesso rapido e seguro sem senhas.';
  const wrapperClassName = embedded
    ? 'flex min-h-full flex-col items-center justify-center p-4 text-white sm:p-6 lg:p-8'
    : 'flex min-h-screen flex-col items-center justify-center bg-[#121212] p-4 text-white';
  const cardClassName = embedded
    ? 'w-full max-w-md rounded-2xl border border-[#243447] bg-[#121212] p-6 shadow-2xl sm:p-8'
    : 'w-full max-w-md rounded-2xl border border-gray-800 bg-[#1a1a1a] p-8 shadow-2xl';

  useEffect(() => {
    const savedTime = localStorage.getItem('rcmolina_otp_cooldown');
    if (savedTime) {
      const elapsed = Math.floor((Date.now() - parseInt(savedTime)) / 1000);
      const remaining = 60 - elapsed;
      if (remaining > 0) {
        setCooldown(remaining);
      } else {
        localStorage.removeItem('rcmolina_otp_cooldown');
      }
    }
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            localStorage.removeItem('rcmolina_otp_cooldown');
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
    localStorage.setItem('rcmolina_otp_cooldown', Date.now().toString());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;

    const form = e.currentTarget.form;
    if (!form) return;

    const elements = Array.from(form.elements).filter((el) => {
      const element = el as HTMLElement;
      return element.tagName === 'INPUT' && (element as HTMLInputElement).type !== 'file';
    }) as HTMLElement[];

    const index = elements.indexOf(e.currentTarget);
    if (index > -1 && index < elements.length - 1) {
      e.preventDefault();
      elements[index + 1].focus();
    }
  };

  const verifyProfileExists = async (emailToCheck: string) => {
    const { data: profile, error: profileError } = await supabase.rpc('usuarios_email_existe', {
      p_email: emailToCheck,
    });

    if (profileError) console.warn('Erro ao consultar RCMOLINASEGUROS.USUARIOS:', profileError.message);
    return profile;
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const normalizedEmail = email.trim().toLowerCase();

    if (!validarEmailRFC5322(normalizedEmail)) {
      setError('Por favor, insira um e-mail em formato valido.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: authError } = await supabase.rpc('usuarios_login', {
        p_email: normalizedEmail,
        p_senha: password,
      });

      const perfil = Array.isArray(data) ? data[0] : null;

      if (authError || !perfil) {
        const profile = await verifyProfileExists(normalizedEmail);
        setError(profile ? 'Senha incorreta.' : 'E-mail nao cadastrado ou senha incorreta.');
        setLoading(false);
        setTimeout(() => {
          passwordInputRef.current?.focus();
          passwordInputRef.current?.select();
        }, 50);
        return;
      }

      onLogin?.(perfil);
      setShowPopup(true);
      setTimeout(() => navigate('/dashboard'), 600);
    } catch (loginError) {
      console.error('Erro de login:', loginError);
      setError('Nao foi possivel concluir o login agora.');
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (cooldown > 0) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!validarEmailRFC5322(normalizedEmail)) {
      setError('Por favor, insira um e-mail em formato valido.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/send-login-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const payload = await response.json().catch(() => ({}));

      if (response.status === 429) {
        setError(payload.error || 'Aguarde 60 segundos entre solicitacoes de codigo.');
      } else if (!response.ok && response.status !== 200) {
        setError(payload.error || 'Nao foi possivel enviar o codigo seguro.');
      } else {
        setSuccess('Se este e-mail estiver cadastrado, voce recebera o codigo seguro.');
        setOtpStage('verify');
        handleSetCooldown();
      }
    } catch (sendError) {
      console.error('Erro ao enviar codigo seguro:', sendError);
      setError('Nao foi possivel enviar o codigo seguro agora.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (otpCode.length !== 6) {
      setError('O codigo deve conter 6 digitos.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: verifyError } = await supabase.rpc('usuarios_verificar_codigo_login', {
        p_email: email.trim().toLowerCase(),
        p_codigo: otpCode,
      });

      const perfil = Array.isArray(data) ? data[0] : null;

      if (verifyError) {
        const msg = verifyError.message?.toLowerCase() || '';
        if (msg.includes('rate_limit')) {
          setError('Aguarde 60 segundos entre solicitacoes.');
        } else {
          setError('Nao foi possivel verificar o codigo agora.');
        }
        setLoading(false);
        return;
      }

      if (!perfil) {
        setError('Codigo invalido, expirado ou bloqueado. Verifique ou solicite um novo codigo.');
        setLoading(false);
        return;
      }

      onLogin?.(perfil);
      setShowPopup(true);
      setTimeout(() => navigate('/dashboard'), 600);
    } catch (verifyError) {
      console.error('Erro ao verificar codigo seguro:', verifyError);
      setError('Nao foi possivel verificar o codigo agora.');
      setLoading(false);
    }
  };

  return (
    <div id="SCR-002" data-name="telalogin" className={wrapperClassName}>
      <div className={cardClassName}>
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-6 rounded bg-black px-6 py-3">
            <div className="font-serif text-xl font-bold tracking-widest text-[#d4af37]">RC MOLINA</div>
            <div className="text-center text-[10px] tracking-[0.3em] text-white">CORRETORA</div>
          </div>
          <h1 className="mb-2 text-center text-3xl font-bold">{heading}</h1>
          <p className="text-center text-sm text-gray-400">{subtitle}</p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500 bg-red-900/10 p-4 text-center text-sm text-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl border border-green-500 bg-green-900/10 p-4 text-center text-sm text-green-200">
            {success}
          </div>
        )}

        {loginMethod === 'password' && (
          <form onSubmit={handlePasswordLogin} className="space-y-6" autoComplete="off">
            <div>
              <label className="mb-2 block text-sm font-bold">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={(e) => {
                  if (!email || !validarEmailRFC5322(email.trim().toLowerCase())) {
                    setError('Obrigatorio preencher um e-mail valido.');
                    e.target.focus();
                  } else {
                    setError('');
                  }
                }}
                placeholder="voce@exemplo.com"
                autoComplete="off"
                className="w-full rounded-xl border border-gray-700 bg-[#121212] p-4 transition focus:border-[#ccff00] focus:outline-none"
                required
              />
            </div>

            <div>
              <div className="mb-2 flex justify-between">
                <label className="text-sm font-bold">Senha</label>
                {!embedded ? (
                  <button
                    type="button"
                    onClick={() => navigate('/recuperar-senha')}
                    className="text-xs text-gray-500 hover:text-[#ccff00]"
                  >
                    Esqueceu sua senha?
                  </button>
                ) : null}
              </div>
              <div className="relative">
                <input
                  ref={passwordInputRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={(e) => {
                    if (!password || password.length < 8) {
                      setError('Obrigatorio informar senha com no minimo 8 caracteres.');
                      e.target.focus();
                    } else {
                      setError('');
                    }
                  }}
                  placeholder="Digite sua senha"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-gray-700 bg-[#121212] p-4 pr-12 transition focus:border-[#ccff00] focus:outline-none"
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
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ccff00] p-4 text-lg font-black text-black transition hover:bg-[#b3e600]"
            >
              {loading ? 'Aguarde...' : 'Entrar ->'}
            </button>
          </form>
        )}

        {loginMethod === 'otp' && otpStage === 'request' && (
          <form onSubmit={handleSendOtp} className="space-y-6" autoComplete="off">
            <div>
              <label className="mb-2 block text-sm font-bold">E-mail Cadastrado</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="voce@exemplo.com"
                autoComplete="off"
                disabled={cooldown > 0}
                className="w-full rounded-xl border border-gray-700 bg-[#121212] p-4 transition focus:border-[#ccff00] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || cooldown > 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ccff00] p-4 text-lg font-black text-black transition hover:bg-[#b3e600] disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
            >
              {loading
                ? 'Aguarde...'
                : cooldown > 0
                  ? `Aguarde ${cooldown}s para reenviar`
                  : 'Enviar Codigo de Acesso ->'
              }
            </button>
          </form>
        )}

        {loginMethod === 'otp' && otpStage === 'verify' && (
          <form onSubmit={handleVerifyOtp} className="space-y-6" autoComplete="off">
            <div className="mb-4 rounded-xl border border-green-500 bg-green-900/10 p-4 text-sm text-green-200">
              Enviamos um codigo de acesso para <strong>{email}</strong>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold">Codigo de Acesso</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full rounded-xl border border-gray-700 bg-[#121212] p-4 text-center text-2xl tracking-[0.5em] transition focus:border-[#ccff00] focus:outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length < 6}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ccff00] p-4 text-lg font-black text-black transition hover:bg-[#b3e600] disabled:opacity-50"
            >
              {loading ? 'Verificando...' : 'Confirmar e Entrar ->'}
            </button>
            <div className="mt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setOtpCode('');
                  setOtpStage('request');
                }}
                className="text-sm text-gray-500 hover:text-white"
              >
                Corrigir E-mail
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 border-t border-gray-800 pt-6">
          <div className="relative mb-6 flex items-center justify-center">
            <span className="relative -mt-10 bg-[#1a1a1a] px-4 text-xs font-bold uppercase tracking-widest text-gray-500">ou</span>
          </div>

          <button
            onClick={() => {
              setError('');
              setSuccess('');
              setLoginMethod(loginMethod === 'password' ? 'otp' : 'password');
              setOtpStage('request');
              setOtpCode('');
            }}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-700 bg-[#121212] p-3 transition hover:bg-gray-800"
          >
            {loginMethod === 'password' ? (
              <>
                <Mail size={18} className="text-[#ccff00]" />
                <span className="font-semibold text-gray-300">Entrar com Codigo Seguro (E-mail)</span>
              </>
            ) : (
              <>
                <KeyRound size={18} className="text-[#ccff00]" />
                <span className="font-semibold text-gray-300">Entrar com Senha</span>
              </>
            )}
          </button>
        </div>

        {!embedded ? (
          <>
            <p className="mt-8 text-center text-sm text-gray-400">
              Ainda nao tem conta?{' '}
              <button onClick={() => navigate('/cadastro')} className="font-bold text-[#ccff00] hover:underline">
                Cadastre-se
              </button>
            </p>

            <FooterAdmin />
          </>
        ) : null}
      </div>

      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-sm animate-in flex-col items-center rounded-2xl border border-[#ccff00]/50 bg-[#1a1a1a] p-8 shadow-2xl duration-300 fade-in zoom-in">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#ccff00]/10 text-[#ccff00]">
              <svg className="h-10 w-10 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 className="mb-2 text-2xl font-bold text-white">Bem-vindo(a)!</h2>
            <p className="mb-8 text-center text-gray-400">Login realizado com sucesso. Redirecionando para sua conta...</p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
              <div className="h-full animate-progress-bar bg-[#ccff00]"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
