import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Camera, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { validarEmailRFC5322 } from '../../lib/validacoes';
import { FooterAdmin } from '../shared/footer_admin';

export const Cadastro: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    confirmarSenha: '',
    organizacao: '',
  });

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Preenche o e-mail e senha se vierem da tela de login
  useEffect(() => {
    if (location.state) {
      const { email, password } = location.state as any;
      if (email || password) {
        setFormData(prev => ({
          ...prev,
          email: email || prev.email,
          senha: password || prev.senha,
          confirmarSenha: password || prev.confirmarSenha
        }));
      }
    }
  }, [location.state]);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // ValidaÃ§Ã£o de Nome (MÃ­nimo 2 palavras)
    if (formData.nome.trim().split(' ').length < 2) {
      setError('Por favor, insira seu nome completo.');
      return;
    }

    const normalizedEmail = formData.email.trim().toLowerCase();

    // ValidaÃ§Ã£o de E-mail RFC 5322
    if (!validarEmailRFC5322(normalizedEmail)) {
      setError('Por favor, insira um e-mail em formato vÃ¡lido.');
      return;
    }

    if (formData.senha !== formData.confirmarSenha) {
      setError('As senhas nÃ£o coincidem.');
      return;
    }

    if (formData.senha.length < 8) {
      setError('A senha deve ser forte: mÃ­nimo de 8 caracteres.');
      return;
    }

    // ValidaÃ§Ã£o de complexidade de senha (opcional, mas recomendado para "senhas fortes")
    const regexSenhaForte = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!regexSenhaForte.test(formData.senha)) {
      setError('A senha deve conter pelo menos 8 caracteres, incluindo letras maiÃºsculas, minÃºsculas, nÃºmeros e caracteres especiais.');
      return;
    }

    setLoading(true);

    try {
      // Verifica se o e-mail ja existe na tabela de usuarios
      const { data: existingUser } = await supabase.rpc('usuarios_email_existe', {
        p_email: normalizedEmail,
      });

      if (existingUser) {
        setError('Este e-mail jÃ¡ estÃ¡ cadastrado. Por favor, faÃ§a login.');
        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn('Aviso: Nao foi possivel verificar usuario existente via tabela RCMOLINASEGUROS.USUARIOS.');
    }

    try {
      let finalAvatarUrl = null;
      const userId = crypto.randomUUID();

      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${userId}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile);

        if (uploadError) {
          console.error('Erro no upload do avatar:', uploadError);
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
          finalAvatarUrl = publicUrlData.publicUrl;
        }
      }

      const { error: profileError } = await supabase.rpc('usuarios_cadastrar', {
        p_email: normalizedEmail,
        p_senha: formData.senha,
        p_nome_completo: formData.nome.toUpperCase(),
        p_organizacao: formData.organizacao,
        p_avatar_url: finalAvatarUrl,
      });

      if (profileError) {
        throw profileError;
      }

      setSuccess('Usuario cadastrado com sucesso! Redirecionando para login...');
      setTimeout(() => navigate('/login'), 2500);
    } catch (error: any) {
      setError(error?.message || 'Nao foi possivel cadastrar o usuario.');
      setLoading(false);
    }
  };

  return (
    <div id="SCR-003" data-name="crieconta" className="flex flex-col items-center justify-center min-h-screen bg-[#121212] text-white p-4">
      <div className="w-full max-w-md bg-[#1a1a1a] p-8 rounded-2xl shadow-2xl border border-gray-800">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Crie sua conta</h1>
          <p className="text-gray-400 text-sm">Preencha os dados abaixo para comecar.</p>
        </div>

        <div className="flex flex-col items-center mb-8">
          <div
            onClick={triggerFileInput}
            className="w-24 h-24 rounded-full border-2 border-[#ccff00] flex items-center justify-center relative bg-[#121212] overflow-hidden group cursor-pointer"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="text-gray-500 group-hover:text-[#ccff00] transition" size={48} />
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              <span className="text-[10px] font-bold">ALTERAR</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 cursor-pointer" onClick={triggerFileInput}>
            <Camera size={14} className="text-[#ccff00]" />
            <span className="text-[#ccff00] text-[10px] font-bold uppercase tracking-widest">foto</span>
          </div>
          <input
            id="cadastro_avatar_upload"
            title="Selecionar foto de perfil"
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
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

        <form onSubmit={handleCadastro} className="space-y-5">
          <div>
            <label className="block text-sm font-bold mb-2">Nome Completo</label>
            <input
              type="text"
              value={formData.nome}
              onChange={(e) => {
                const alphaOnly = e.target.value.toUpperCase().replace(/[^A-ZÀ-Ÿ\s]/g, '');
                setFormData({ ...formData, nome: alphaOnly });
              }}
              onKeyDown={handleKeyDown}
              onBlur={(e) => {
                if (formData.nome.trim().split(' ').length < 2) {
                  setError('ObrigatÃ³rio informar o nome completo vÃ¡lido (mÃ­n. 2 nomes).');
                  e.target.focus();
                } else {
                  setError('');
                }
              }}
              placeholder="SOMENTE LETRAS MAIÃšSCULAS"
              className="w-full bg-[#121212] border border-gray-700 rounded-xl p-4 focus:outline-none focus:border-[#ccff00] transition uppercase"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">E-mail</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              onKeyDown={handleKeyDown}
              onBlur={(e) => {
                if (!formData.email || !validarEmailRFC5322(formData.email.trim().toLowerCase())) {
                  setError('ObrigatÃ³rio preencher um e-mail vÃ¡lido.');
                  e.target.focus();
                } else {
                  setError('');
                }
              }}
              placeholder="vocÃª@exemplo.com"
              className="w-full bg-[#121212] border border-gray-700 rounded-xl p-4 focus:outline-none focus:border-[#ccff00] transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.senha}
                onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                onKeyDown={handleKeyDown}
                onBlur={(e) => {
                  const regexSenhaForte = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
                  if (!formData.senha || formData.senha.length < 8) {
                    setError('ObrigatÃ³rio preencher a senha com no mÃ­nimo 8 caracteres.');
                    e.target.focus();
                  } else if (!regexSenhaForte.test(formData.senha)) {
                    setError('A senha deve ser forte: ter letras maiÃºsculas, minÃºsculas, nÃºmeros e caracteres especiais.');
                    e.target.focus();
                  } else {
                    setError('');
                  }
                }}
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
            <label className="block text-sm font-bold mb-2">Redigite sua senha</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmarSenha}
                onChange={(e) => setFormData({ ...formData, confirmarSenha: e.target.value })}
                onKeyDown={handleKeyDown}
                onBlur={(e) => {
                  if (!formData.confirmarSenha || formData.confirmarSenha !== formData.senha) {
                    setError('A confirmaÃ§Ã£o deve ser preenchida e idÃªntica Ã  senha.');
                    e.target.focus();
                  } else {
                    setError('');
                  }
                }}
                placeholder="Confirme sua senha"
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

          <div>
            <label className="block text-sm font-bold mb-2">Nome da organizaÃ§Ã£o <span className="text-gray-500 font-normal">(Opcional)</span></label>
            <input
              type="text"
              value={formData.organizacao}
              onChange={(e) => {
                const alphaOnly = e.target.value.toUpperCase().replace(/[^A-ZÀ-Ÿ\s]/g, '');
                setFormData({ ...formData, organizacao: alphaOnly });
              }}
              onKeyDown={handleKeyDown}
              placeholder="NOME DA SUA ORGANIZAÃ‡ÃƒO (OPCIONAL)"
              className="w-full bg-[#121212] border border-gray-700 rounded-xl p-4 focus:outline-none focus:border-[#ccff00] transition uppercase"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#ccff00] text-black font-black text-lg rounded-xl p-4 hover:bg-[#b3e600] transition flex justify-center items-center gap-2 mt-4"
          >
            {loading ? 'Aguarde...' : 'Criar uma conta ->'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-8">
          JÃ¡ tem uma conta? <button onClick={() => navigate('/login')} className="text-[#ccff00] font-bold hover:underline">Iniciar sessÃ£o</button>
        </p>

        <FooterAdmin />
      </div>
    </div>
  );
};
