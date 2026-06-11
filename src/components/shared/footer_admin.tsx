import React, { useState, useRef, useEffect } from 'react';
import { Camera, User, Lock, Trash2, Save, X } from 'lucide-react';
import {
    apiAdminDeleteUser,
    apiAdminListUsers,
    apiAdminLogin,
    apiAdminUpdateUser,
} from '../../lib/local_api';
import { getStoredSession, type UsuarioPerfil } from '../../lib/local_auth';
import { validarEmailRFC5322 } from '../../lib/validacoes';

const senhaAtendeCriterios = (senha: string) =>
    senha.length >= 8 && /[A-Za-z]/.test(senha) && /\d/.test(senha) && /[^A-Za-z0-9\s]/.test(senha);

export const FooterAdmin: React.FC = () => {
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');

    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [adminToken, setAdminToken] = useState('');
    const [users, setUsers] = useState<UsuarioPerfil[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const isSuperAdmin = getStoredSession()?.user?.email === 'admin@rcmolina.com.br' || adminEmail === 'admin@rcmolina.com.br';
    const [permissions, setPermissions] = useState<Record<string, boolean>>({
        'Home': true,
        'Meus clientes': true,
        'Agenda': true,
        'Links': true,
        'Webmail': true,
        'Campanhas': true,
        'Financeiro': true,
        'Configurações': true,
    });

    // Form states
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [formData, setFormData] = useState({
        nome: '',
        email: '',
        senha: '',
        organizacao: '',
    });
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    const fetchUsers = async () => {
        if (!adminToken) return;

        setLoading(true);
        // Não precisamos mais passar o Hash. O próprio token do usuário logado é enviado pelos Headers nativamente.
        const { data, error } = await apiAdminListUsers(adminToken);
        if (error) {
            console.error('Error fetching users', error);
            setMessage({ text: 'Erro ao carregar usuários', type: 'error' });
        } else if (data) {
            setUsers(data);
        }
        setLoading(false);
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError('');
        
        const { data, error } = await apiAdminLogin(adminEmail, adminPassword);

        if (error) {
            setPasswordError('Credenciais inválidas. Acesso negado.');
        } else {
            setAdminToken(data?.token || '');
            setShowPasswordModal(false);
            setAdminPassword('');
            setShowAdminPanel(true);
        }
    };

    const handleAdminClick = () => {
        if (adminToken) {
            // Se já tiver uma sessão válida de administrador (vamos verificar via chamada RPC ou simplesmente pular a senha)
            setShowAdminPanel(true);
            return;
        }

        setShowPasswordModal(true);
    };

    useEffect(() => {
        if (showAdminPanel && adminToken) {
            fetchUsers();
        }
    }, [showAdminPanel, adminToken]);

    const handleSelectUser = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSelectedUserId(id);
        setMessage({ text: '', type: '' });

        if (id) {
            const user = users.find(u => u.id === id);
            if (user) {
                setFormData({
                    nome: user.nome_completo || '',
                    email: user.email || '',
                    senha: '',
                    organizacao: user.organizacao || '',
                });
                setAvatarUrl(user.avatar_url || null);
                setLogoUrl(user.logo_url || null);
                if (user.email === 'admin@rcmolina.com.br') {
                    setPermissions({
                        'Home': true,
                        'Meus clientes': true,
                        'Agenda': true,
                        'Links': true,
                        'Webmail': true,
                        'Campanhas': true,
                        'Financeiro': true,
                        'Configurações': true,
                    });
                } else if (user.permissoes) {
                    setPermissions({
                        'Home': true,
                        'Meus clientes': user.permissoes['Meus clientes'] ?? true,
                        'Agenda': user.permissoes['Agenda'] ?? true,
                        'Links': user.permissoes['Links'] ?? true,
                        'Webmail': user.permissoes['Webmail'] ?? true,
                        'Campanhas': user.permissoes['Campanhas'] ?? true,
                        'Financeiro': user.permissoes['Financeiro'] ?? true,
                        'Configurações': user.permissoes['Configurações'] ?? true,
                    });
                } else {
                    setPermissions({
                        'Home': true,
                        'Meus clientes': true,
                        'Agenda': true,
                        'Links': true,
                        'Webmail': true,
                        'Campanhas': true,
                        'Financeiro': true,
                        'Configurações': true,
                    });
                }
            }
        } else {
            setFormData({ nome: '', email: '', senha: '', organizacao: '' });
            setAvatarUrl(null);
            setLogoUrl(null);
        }
        setAvatarFile(null);
        setLogoFile(null);
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

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUserId) return;

        setLoading(true);
        setMessage({ text: '', type: '' });

        if (!validarEmailRFC5322(formData.email.trim().toLowerCase())) {
            setMessage({ text: 'E-mail inválido.', type: 'error' });
            setLoading(false);
            return;
        }

        if (formData.senha.trim() && !senhaAtendeCriterios(formData.senha.trim())) {
            setMessage({ text: 'A nova senha deve ter no minimo 8 caracteres, com letra, numero e caractere especial.', type: 'error' });
            setLoading(false);
            return;
        }

        try {
            let finalAvatarUrl = avatarUrl;
            let finalLogoUrl = logoUrl;

            const { error } = await apiAdminUpdateUser(adminToken, selectedUserId, {
                nome: formData.nome.toUpperCase(),
                email: formData.email.trim().toLowerCase(),
                senha: formData.senha.trim(),
                organizacao: formData.organizacao.toUpperCase(),
                avatar_url: finalAvatarUrl,
                avatar_data_url: avatarFile ? avatarUrl : null,
                avatar_file_name: avatarFile?.name || null,
                logo_url: finalLogoUrl,
                logo_data_url: logoFile ? logoUrl : null,
                logo_file_name: logoFile?.name || null,
                permissoes: JSON.stringify(permissions),
            });

            if (error) throw new Error(error);

            setMessage({ text: 'Usuário atualizado com sucesso!', type: 'success' });
            setFormData((current) => ({ ...current, senha: '' }));
            await fetchUsers(); // refresh the user list
        } catch (error: any) {
            setMessage({ text: 'Erro ao atualizar: ' + error.message, type: 'error' });
        }
        setLoading(false);
    };

    const handleDeleteUser = async () => {
        if (!selectedUserId) return;
        if (!window.confirm('Tem certeza que deseja excluir este usuário?')) return;

        setLoading(true);
        setMessage({ text: '', type: '' });

        try {
            const { error } = await apiAdminDeleteUser(adminToken, selectedUserId);

            if (error) throw new Error(error);

            setMessage({ text: 'Usuário excluído com sucesso!', type: 'success' });
            setSelectedUserId('');
            setFormData({ nome: '', email: '', senha: '', organizacao: '' });
            setAvatarUrl(null);
            setLogoUrl(null);
            await fetchUsers();
        } catch (error: any) {
            setMessage({ text: 'Erro ao excluir: ' + error.message, type: 'error' });
        }
        setLoading(false);
    };

    return (
        <>
            <div className="mt-8 text-center text-sm text-gray-500 font-black">
                CKDEV Soluções em TI <span className="cursor-pointer" onClick={handleAdminClick}>–</span> (21) 98868-1799
            </div>

            {/* PASSWORD MODAL */}
            {showPasswordModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-[#1a1a1a] shadow-2xl border border-gray-800 rounded-2xl p-8 max-w-sm w-full flex flex-col items-center animate-in fade-in zoom-in duration-300 relative pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => { setShowPasswordModal(false); setPasswordError(''); setAdminPassword(''); }}
                            className="absolute top-4 right-4 text-gray-500 hover:text-white"
                            title="Fechar"
                            aria-label="Fechar"
                        >
                            <X size={20} />
                        </button>

                        <div className="w-16 h-16 bg-[#ccff00]/10 text-[#ccff00] rounded-full flex items-center justify-center mb-6">
                            <Lock size={32} />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-6">Acesso Administrativo</h2>

                        {passwordError && (
                            <div className="bg-red-900/10 border border-red-500 text-red-200 p-3 rounded-lg w-full mb-4 text-sm text-center">
                                {passwordError}
                            </div>
                        )}

                        <form onSubmit={handlePasswordSubmit} className="w-full space-y-4" autoComplete="off">
                            <input
                                id="admin_email"
                                name="admin_email"
                                type="email"
                                value={adminEmail}
                                onChange={(e) => setAdminEmail(e.target.value)}
                                placeholder="E-mail Administrativo"
                                autoComplete="username"
                                className="w-full bg-[#121212] border border-gray-700 rounded-xl p-4 focus:outline-none focus:border-[#ccff00] transition"
                            />
                            <input
                                id="admin_secret_key"
                                name="admin_secret_key"
                                type="password"
                                value={adminPassword}
                                onChange={(e) => setAdminPassword(e.target.value)}
                                placeholder="Senha"
                                autoComplete="current-password"
                                className="w-full bg-[#121212] border border-gray-700 rounded-xl p-4 focus:outline-none focus:border-[#ccff00] transition"
                            />
                            <button
                                type="submit"
                                className="w-full bg-[#ccff00] text-black font-black text-lg rounded-xl p-4 hover:bg-[#b3e600] transition"
                            >
                                Entrar
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ADMIN PANEL MODAL */}
            {showAdminPanel && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                    <div className={`bg-[#1a1a1a] shadow-2xl border border-gray-800 rounded-2xl p-4 md:p-6 w-full relative my-4 pointer-events-auto transition-all duration-300 ${isSuperAdmin && selectedUserId ? 'max-w-5xl' : 'max-w-lg'}`} onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => {
                                setAdminToken('');
                                setShowAdminPanel(false);
                            }}
                            className="absolute top-4 left-4 text-red-500 hover:text-red-400 bg-black/50 rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-wider"
                            title="Sair"
                            aria-label="Sair"
                        >
                            Logout
                        </button>

                        <button
                            onClick={() => setShowAdminPanel(false)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-white bg-black/50 rounded-full p-2"
                            title="Fechar painel"
                            aria-label="Fechar painel"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex flex-col items-center mb-4 mt-2">
                            <h1 className="text-2xl font-bold mb-1">Gerenciar Usuários</h1>
                            <p className="text-gray-400 text-sm">Selecione, edite ou exclua os dados dos usuários.</p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-bold mb-2 text-gray-400">Selecionar Usuário</label>
                            <div className="relative">
                                <select
                                    value={selectedUserId}
                                    onChange={(e) => handleSelectUser(e as any)}
                                    className="w-full bg-[#121212] border border-gray-700 rounded-xl p-3 text-white font-semibold focus:outline-none focus:border-[#ccff00] appearance-none cursor-pointer transition"
                                >
                                    <option value="" disabled>-- Selecione um usuário --</option>
                                    {users.map((u) => (
                                        <option key={u.id} value={u.id}>
                                            {u.nome_completo} ({u.email})
                                        </option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                </div>
                            </div>
                        </div>

                        {message.text && (
                            <div className={`p-3 rounded-xl mb-4 text-sm text-center border ${message.type === 'error' ? 'bg-red-900/10 border-red-500 text-red-200' : 'bg-green-900/10 border-green-500 text-green-200'
                                }`}>
                                {message.text}
                            </div>
                        )}

                        {selectedUserId && (
                            <div className="flex flex-col md:flex-row gap-6 animate-in slide-in-from-bottom-4 duration-300">
                                <div className="flex-1 space-y-4">
                                    <div className="flex justify-center gap-6 mb-2">
                                    <div className="flex flex-col items-center">
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-20 h-20 rounded-full border-2 border-[#ccff00] flex items-center justify-center relative bg-[#121212] overflow-hidden group cursor-pointer"
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
                                        <div className="flex items-center gap-2 mt-2 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                            <Camera size={14} className="text-[#ccff00]" />
                                            <span className="text-[#ccff00] text-[10px] font-bold uppercase tracking-widest">foto</span>
                                        </div>
                                        <input
                                            id="upload_avatar"
                                            title="Selecionar foto"
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                    </div>

                                    <div className="flex flex-col items-center">
                                        <div
                                            onClick={() => logoInputRef.current?.click()}
                                            className="w-20 h-20 rounded-full border-2 border-[#ccff00] flex items-center justify-center relative bg-[#121212] overflow-hidden group cursor-pointer"
                                        >
                                            {logoUrl ? (
                                                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-2 bg-white" />
                                            ) : (
                                                <Camera className="text-gray-500 group-hover:text-[#ccff00] transition" size={48} />
                                            )}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                                <span className="text-[10px] font-bold">ALTERAR</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2 cursor-pointer" onClick={() => logoInputRef.current?.click()}>
                                            <Camera size={14} className="text-[#ccff00]" />
                                            <span className="text-[#ccff00] text-[10px] font-bold uppercase tracking-widest">Logo da Empresa</span>
                                        </div>
                                        <input
                                            id="upload_logo"
                                            title="Selecionar logo"
                                            type="file"
                                            ref={logoInputRef}
                                            onChange={handleLogoChange}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                    </div>
                                </div>

                                <form onSubmit={handleSaveUser} className="space-y-3">
                                    <div>
                                        <label htmlFor="edit_nome" className="block text-sm font-bold mb-1">Nome Completo</label>
                                        <input
                                            id="edit_nome"
                                            title="Nome Completo"
                                            type="text"
                                            value={formData.nome}
                                            onChange={(e) => {
                                                const alphaOnly = e.target.value.toUpperCase().replace(/[^A-ZÀ-Ÿ\s]/g, '');
                                                setFormData({ ...formData, nome: alphaOnly });
                                            }}
                                            className="w-full bg-[#121212] border border-gray-700 rounded-xl p-3 focus:outline-none focus:border-[#ccff00] transition uppercase"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="edit_email" className="block text-sm font-bold mb-1">E-mail</label>
                                        <input
                                            id="edit_email"
                                            title="E-mail"
                                            type="email"
                                            autoComplete="off"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full bg-[#121212] border border-gray-700 rounded-xl p-3 focus:outline-none focus:border-[#ccff00] transition"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="edit_senha" className="block text-sm font-bold mb-1">Nova senha</label>
                                        <input
                                            id="edit_senha"
                                            title="Nova senha"
                                            type="text"
                                            autoComplete="new-password"
                                            value={formData.senha}
                                            onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                                            placeholder="Preencha somente para alterar"
                                            className="w-full bg-[#121212] border border-gray-700 rounded-xl p-3 focus:outline-none focus:border-[#ccff00] transition"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="edit_org" className="block text-sm font-bold mb-1">Organização</label>
                                        <input
                                            id="edit_org"
                                            title="Organização"
                                            type="text"
                                            value={formData.organizacao}
                                            onChange={(e) => {
                                                const alphaOnly = e.target.value.toUpperCase().replace(/[^A-ZÀ-Ÿ\s]/g, '');
                                                setFormData({ ...formData, organizacao: alphaOnly });
                                            }}
                                            className="w-full bg-[#121212] border border-gray-700 rounded-xl p-3 focus:outline-none focus:border-[#ccff00] transition uppercase"
                                        />
                                    </div>

                                    <div className="flex gap-4 pt-4">
                                        <button
                                            type="button"
                                            onClick={handleDeleteUser}
                                            disabled={loading || formData.email === 'admin@rcmolina.com.br'}
                                            className="flex-1 bg-red-900/20 text-red-500 border border-red-900/50 hover:bg-red-900/40 hover:text-red-400 font-bold text-sm lg:text-base rounded-xl p-3 transition flex justify-center items-center gap-2 disabled:opacity-50"
                                        >
                                            <Trash2 size={18} />
                                            Excluir
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="flex-1 bg-[#ccff00] text-black font-black text-sm lg:text-base rounded-xl p-3 hover:bg-[#b3e600] transition flex justify-center items-center gap-2 disabled:opacity-50"
                                        >
                                            {loading ? 'Adicionando...' : <><Save size={18} /> Salvar</>}
                                        </button>
                                    </div>
                                </form>
                                </div>
                                {isSuperAdmin && (
                                    <div className="flex-1 border-t md:border-t-0 md:border-l border-gray-800 pt-6 md:pt-0 md:pl-6">
                                        <h2 className="text-xl font-black mb-4 text-white flex items-center gap-2">Opções do Sistema</h2>
                                        <div className="space-y-2">
                                            {Object.keys(permissions).map(option => (
                                                <div key={option} className="flex items-center justify-between bg-[#121212] p-3 rounded-xl border border-gray-800">
                                                    <span className="font-bold text-white text-sm">{option}</span>
                                                    <div className="flex items-center gap-4">
                                                        <label className={`flex items-center gap-2 ${formData.email === 'admin@rcmolina.com.br' || option === 'Home' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                                                            <input disabled={formData.email === 'admin@rcmolina.com.br' || option === 'Home'} type="radio" name={`perm_${option}`} checked={permissions[option]} onChange={() => setPermissions(p => ({ ...p, [option]: true }))} className="accent-[#ccff00] w-4 h-4" />
                                                            <span className={`text-xs font-bold text-gray-400 transition ${formData.email !== 'admin@rcmolina.com.br' && option !== 'Home' ? 'group-hover:text-white' : ''}`}>HABILITADO</span>
                                                        </label>
                                                        <label className={`flex items-center gap-2 ${formData.email === 'admin@rcmolina.com.br' || option === 'Home' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                                                            <input disabled={formData.email === 'admin@rcmolina.com.br' || option === 'Home'} type="radio" name={`perm_${option}`} checked={!permissions[option]} onChange={() => setPermissions(p => ({ ...p, [option]: false }))} className="accent-red-500 w-4 h-4" />
                                                            <span className={`text-xs font-bold text-gray-400 transition ${formData.email !== 'admin@rcmolina.com.br' && option !== 'Home' ? 'group-hover:text-white' : ''}`}>DESABILITADO</span>
                                                        </label>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>
            )}
        </>
    );
};
