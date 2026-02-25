import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Camera, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { validarEmailRFC5322 } from '../lib/validacoes';

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

    // Validação de Nome (Mínimo 2 palavras)
    if (formData.nome.trim().split(' ').length < 2) {
      setError('Por favor, insira seu nome completo.');
      return;
    }

    const normalizedEmail = formData.email.trim().toLowerCase();

    // Validação de E-mail RFC 5322
    if (!validarEmailRFC5322(normalizedEmail)) {
      setError('Por favor, insira um e-mail em formato válido.');
      return;
    }

    if (formData.senha !== formData.confirmarSenha) {
      setError('As senhas não coincidem.');
      return;
    }

    if (formData.senha.length < 8) {
      setError('A senha deve ser forte: mínimo de 8 caracteres.');
      return;
    }

    // Validação de complexidade de senha (opcional, mas recomendado para "senhas fortes")
    const regexSenhaForte = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!regexSenhaForte.test(formData.senha)) {
      setError('A senha deve conter pelo menos 8 caracteres, incluindo letras maiúsculas, minúsculas, números e caracteres especiais.');
      return;
    }

    setLoading(true);

    try {
      // Verifica se o e-mail já existe na tabela de perfis
      const { data: existingUser } = await supabase
        .from('perfis')
        .select('email')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (existingUser) {
        setError('Este e-mail já está cadastrado. Por favor, faça login.');
        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn('Aviso: Não foi possível verificar usuário existente via tabela perfis.');
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: formData.senha,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: formData.nome.toUpperCase(),
          organization: formData.organizacao,
        }
      }
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
    } else if (signUpData.user && signUpData.user.identities && signUpData.user.identities.length === 0) {
      setError('Este e-mail já está em uso. Por favor, faça login ou recupere sua senha.');
      setLoading(false);
    } else {
      let finalAvatarUrl = null;

      if (avatarFile && signUpData.user) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${signUpData.user.id}-${Math.random().toString(36).substring(7)}.${fileExt}`;

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

      // Tenta criar o perfil na tabela 'perfis' com nomes em português
      const { error: profileError } = await supabase
        .from('perfis')
        .insert([
          {
            id: signUpData.user?.id,
            email: normalizedEmail,
            nome_completo: formData.nome.toUpperCase(),
            organizacao: formData.organizacao,
            avatar_url: finalAvatarUrl
          }
        ]);

      if (profileError) {
        console.error('Erro ao criar perfil:', profileError);
      }

      alert('Usuário cadastrado com sucesso! Faça seu login.');
      navigate('/login');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#121212] text-white p-4">
      <div className="w-full max-w-md bg-[#1a1a1a] p-8 rounded-2xl shadow-2xl border border-gray-800">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Crie sua conta</h1>
          <p className="text-gray-400 text-sm">Preencha os dados abaixo para começar.</p>
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
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500 text-red-200 p-3 rounded-lg mb-6 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleCadastro} className="space-y-5">
          <div>
            <label className="block text-sm font-bold mb-2">Nome Completo</label>
            <input
              type="text"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value.toUpperCase() })}
              onKeyDown={handleKeyDown}
              placeholder="SOMENTE LETRAS MAIÚSCULAS"
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
              placeholder="você@exemplo.com"
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
            <label className="block text-sm font-bold mb-2">Nome da organização <span className="text-gray-500 font-normal">(Opcional)</span></label>
            <input
              type="text"
              value={formData.organizacao}
              onChange={(e) => setFormData({ ...formData, organizacao: e.target.value })}
              onKeyDown={handleKeyDown}
              placeholder="Nome da sua organização"
              className="w-full bg-[#121212] border border-gray-700 rounded-xl p-4 focus:outline-none focus:border-[#ccff00] transition"
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
          Já tem uma conta? <button onClick={() => navigate('/login')} className="text-[#ccff00] font-bold hover:underline">Iniciar sessão</button>
        </p>

        <div className="mt-12 text-center text-sm text-gray-500 font-black">
          CKDEV Soluções em TI – (21) 98868-1799
        </div>
      </div>
    </div>
  );
};
