import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { validarEmailRFC5322, traduzirErroSupabase } from '../lib/validacoes';
import { FooterAdmin } from './FooterAdmin';

interface LoginProps {
  embedded?: boolean;
}

export const Login: React.FC<LoginProps> = ({
  embedded = false,
}) => {
  const navigate = useNavigate();
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPopup, setShowPopup] = useState(false);

  // Controles do Fluxo de Login
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

  // ==============================
  // CONTROLE DE COOLDOWN (OTP)
  // ==============================
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

  const verifyProfileExists = async (emailToCheck: string) => {
    const { data: profile, error: profileError } = await supabase
      .from('USUARIOS')
      .select('email')
      .eq('email', emailToCheck)
      .maybeSingle();

    if (profileError) console.warn('Erro ao consultar USUARIOS:', profileError.message);
    return profile;
  };

  // ==============================
  // FLUXO 1: LOGIN POR SENHA
  // ==============================
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const normalizedEmail = email.trim().toLowerCase();

    if (!validarEmailRFC5322(normalizedEmail)) {
      setError('Por favor, insira um e-mail em formato válido.');
      return;
    }

    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (authError) {
      console.error('Erro de login:', authError.message);

      if (authError.message.includes('Email not confirmed')) {
        setError('Por favor, confirme seu e-mail antes de acessar.');
        setLoading(false);
        return;
      }

      const profile = await verifyProfileExists(normalizedEmail);

      if (profile) {
        setError(traduzirErroSupabase(authError.message)); // Senha incorreta
      } else {
        setError('E-mail não cadastrado ou senha incorreta.');
      }

      setLoading(false);
      setTimeout(() => {
        if (passwordInputRef.current) {
          passwordInputRef.current.focus();
          passwordInputRef.current.select();
        }
      }, 50);
    } else {
      setSuccess('');
      setShowPopup(true);
      setTimeout(() => navigate('/dashboard'), 2500);
    }
  };

  // ==============================
  // FLUXO 2: LOGIN POR OTP (6 DIGITOS)
  // ==============================
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (cooldown > 0) {
      return; // Bloqueio de segurança
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!validarEmailRFC5322(normalizedEmail)) {
      setError('Por favor, insira um e-mail em formato válido.');
      return;
    }

    setLoading(true);

    // Antes de mandar o e-mail, verifica se de fato a conta existe
    const profile = await verifyProfileExists(normalizedEmail);
    if (!profile) {
      setError('Este e-mail ainda não está cadastrado em nosso sistema.');
      setLoading(false);
      return;
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: false // Impede criação de contas fantasmas em caso de erro de digitação
      }
    });

    if (otpError) {
      setError(traduzirErroSupabase(otpError.message));

      // Se for erro de muitas tentativas, engatilha o cooldown também para forçar a pausa
      if (otpError.message.toLowerCase().includes('rate limit') || otpError.message.toLowerCase().includes('muitas tentativas')) {
        handleSetCooldown();
      }
    } else {
      setSuccess('Código seguro enviado para o seu e-mail!');
      setOtpStage('verify');
      handleSetCooldown(); // Trava envios repetidos por 60 segundos
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (otpCode.length < 6 || otpCode.length > 8) {
      setError('O código deve conter entre 6 a 8 dígitos.');
      return;
    }

    setLoading(true);

    // Supabase checa o código de 6 dígitos
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otpCode,
      type: 'email'
    });

    if (verifyError) {
      setError('Código inválido ou expirado. Verifique novamente.');
      setLoading(false);
    } else {
      setSuccess('');
      setShowPopup(true);
      setTimeout(() => navigate('/dashboard'), 2500);
    }
  };

  return (
    <div id="SCR-002" data-name="telalogin" className={wrapperClassName}>
      <div className={cardClassName}>
        <div className="flex flex-col items-center mb-8">
          <div className="bg-black px-6 py-3 rounded mb-6">
            <div className="text-[#d4af37] font-serif text-xl tracking-widest font-bold">RC MOLINA</div>
            <div className="text-white text-[10px] tracking-[0.3em] text-center">CORRETORA</div>
          </div>
          <h1 className="mb-2 text-center text-3xl font-bold">{heading}</h1>
          <p className="text-center text-sm text-gray-400">
            {subtitle}
          </p>
        </div>


        {error && (
          <div className="bg-red-900/10 border border-red-500 text-red-200 p-4 rounded-xl mb-6 text-sm text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-900/10 border border-green-500 text-green-200 p-4 rounded-xl mb-6 text-sm text-center">
            {success}
          </div>
        )}

        {/* ============================== */}
        {/* RENDERIZADOR: FLUXO DE SENHA   */}
        {/* ============================== */}
        {loginMethod === 'password' && (
          <form onSubmit={handlePasswordLogin} className="space-y-6" autoComplete="off">
            <div>
              <label className="block text-sm font-bold mb-2">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={(e) => {
                  if (!email || !validarEmailRFC5322(email.trim().toLowerCase())) {
                    setError('Obrigatório preencher um e-mail válido.');
                    e.target.focus();
                  } else {
                    setError('');
                  }
                }}
                placeholder="você@exemplo.com"
                autoComplete="off"
                className="w-full bg-[#121212] border border-gray-700 rounded-xl p-4 focus:outline-none focus:border-[#ccff00] transition"
                required
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
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
                      setError('Obrigatório informar senha com no mínimo 8 caracteres.');
                      e.target.focus();
                    } else {
                      setError('');
                    }
                  }}
                  placeholder="Digite sua senha"
                  autoComplete="new-password"
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
        )}


        {/* ============================== */}
        {/* RENDERIZADOR: FLUXO DE OTP     */}
        {/* ============================== */}
        {loginMethod === 'otp' && otpStage === 'request' && (
          <form onSubmit={handleSendOtp} className="space-y-6" autoComplete="off">
            <div>
              <label className="block text-sm font-bold mb-2">E-mail Cadastrado</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="você@exemplo.com"
                autoComplete="off"
                disabled={cooldown > 0}
                className="w-full bg-[#121212] border border-gray-700 rounded-xl p-4 focus:outline-none focus:border-[#ccff00] transition disabled:opacity-50 disabled:cursor-not-allowed"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || cooldown > 0}
              className="w-full bg-[#ccff00] text-black font-black text-lg rounded-xl p-4 hover:bg-[#b3e600] transition flex justify-center items-center gap-2 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {loading
                ? 'Aguarde...'
                : cooldown > 0
                  ? `Aguarde ${cooldown}s para reenviar`
                  : 'Enviar Código de Acesso ->'
              }
            </button>
          </form>
        )}

        {loginMethod === 'otp' && otpStage === 'verify' && (
          <form onSubmit={handleVerifyOtp} className="space-y-6" autoComplete="off">
            <div className="bg-green-900/10 border border-green-500 text-green-200 p-4 rounded-xl text-sm mb-4">
              Enviamos um código de acesso para <strong>{email}</strong>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">Código de Acesso</label>
              <input
                type="text"
                maxLength={8}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} // Apenas Numeros
                placeholder="00000000"
                className="w-full bg-[#121212] border border-gray-700 rounded-xl p-4 text-center tracking-[0.5em] text-2xl focus:outline-none focus:border-[#ccff00] transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length < 6}
              className="w-full bg-[#ccff00] text-black font-black text-lg rounded-xl p-4 hover:bg-[#b3e600] transition flex justify-center items-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Verificando...' : 'Confirmar e Entrar ->'}
            </button>
            <div className="text-center mt-2">
              <button
                type="button"
                onClick={() => setOtpStage('request')}
                className="text-gray-500 text-sm hover:text-white"
              >
                Corrigir E-mail
              </button>
            </div>
          </form>
        )}


        {/* ============================== */}
        {/* ALTERNADOR DE MÉTODOS DE LOGIN */}
        {/* ============================== */}
        <div className="mt-8 border-t border-gray-800 pt-6">
          <div className="relative flex items-center justify-center mb-6">
            <span className="relative px-4 bg-[#1a1a1a] text-xs text-gray-500 uppercase tracking-widest font-bold -mt-10">ou</span>
          </div>

          <button
            onClick={() => {
              setError('');
              setSuccess('');
              setLoginMethod(loginMethod === 'password' ? 'otp' : 'password');
              setOtpStage('request');
            }}
            className="w-full flex items-center justify-center gap-3 bg-[#121212] border border-gray-700 rounded-xl p-3 hover:bg-gray-800 transition"
          >
            {loginMethod === 'password' ? (
              <>
                <Mail size={18} className="text-[#ccff00]" />
                <span className="font-semibold text-gray-300">Entrar com Código Seguro (E-mail)</span>
              </>
            ) : (
              <>
                <KeyRound size={18} className="text-[#ccff00]" />
                <span className="font-semibold text-gray-300">Entrar com Senha Clássica</span>
              </>
            )}
          </button>
        </div>

        {!embedded ? (
          <>
            <p className="mt-8 text-center text-sm text-gray-400">
              Ainda não tem conta? <button onClick={() => navigate('/cadastro')} className="font-bold text-[#ccff00] hover:underline">Cadastre-se</button>
            </p>

            <FooterAdmin />
          </>
        ) : null}
      </div>

      {/* POPUP DE BOAS-VINDAS */}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] shadow-2xl border border-[#ccff00]/50 rounded-2xl p-8 max-w-sm w-full flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-[#ccff00]/10 text-[#ccff00] rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Bem-vindo(a)!</h2>
            <p className="text-gray-400 text-center mb-8">
              Login realizado com sucesso. Redirecionando para sua conta...
            </p>
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#ccff00] animate-progress-bar"
              ></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
