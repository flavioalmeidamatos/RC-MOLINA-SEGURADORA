import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const DebugDatabase: React.FC = () => {
  const [perfis, setPerfis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connInfo, setConnInfo] = useState({ url: '', hasKey: false });

  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL || 'NÃO DEFINIDO';
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    setConnInfo({
      url: url.replace(/(https:\/\/)(.*)(\.supabase\.co)/, '$1******$3'),
      hasKey: !!key
    });

    const fetchPerfis = async () => {
      try {
        if (!url || url === 'NÃO DEFINIDO' || !key) {
          throw new Error('Configurações do Supabase (URL ou Chave) ausentes no ambiente.');
        }

        const { data, error } = await supabase
          .from('perfis')
          .select('*');

        if (error) throw error;
        setPerfis(data || []);
      } catch (err: any) {
        console.error('Erro ao buscar perfis:', err);
        setError(err.message || 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    fetchPerfis();
  }, []);

  if (loading) return (
    <div className="p-8 bg-[#121212] min-h-screen text-white">
      <div className="animate-pulse flex flex-col gap-4">
        <div className="h-8 bg-gray-800 rounded w-1/4"></div>
        <div className="h-64 bg-gray-800 rounded"></div>
      </div>
      <p className="mt-4 text-gray-500">Conectando ao Supabase...</p>
    </div>
  );

  return (
    <div className="p-8 bg-[#121212] min-h-screen text-white">
      {!connInfo.hasKey || connInfo.url === 'NÃO DEFINIDO' ? (
        <div className="mb-8 p-6 bg-yellow-900/20 border border-yellow-500/50 rounded-xl text-yellow-200">
          <h2 className="text-xl font-bold mb-2">⚠️ Chaves de Conexão Ausentes</h2>
          <p className="mb-4">O aplicativo não encontrou as chaves do Supabase. Você precisa configurá-las no painel de <strong>Secrets</strong> do AI Studio.</p>
          <ul className="list-disc list-inside text-sm opacity-90 space-y-1">
            <li>VITE_SUPABASE_URL</li>
            <li>VITE_SUPABASE_ANON_KEY</li>
          </ul>
        </div>
      ) : (
        <div className="mb-8 p-4 bg-[#1a1a1a] border border-gray-800 rounded-xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Status da Conexão</h2>
            <button
              onClick={() => window.location.reload()}
              className="text-xs bg-[#ccff00] text-black px-3 py-1 rounded-full font-bold hover:bg-white transition"
            >
              Atualizar Dados
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">URL do Projeto:</span> <code className="text-[#ccff00]">{connInfo.url}</code></div>
            <div><span className="text-gray-500">Chave Anon:</span> <span className="text-green-500 font-bold">CONFIGURADA ✅</span></div>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold mb-6 text-[#ccff00]">Registros na Tabela 'perfis'</h1>

      {error ? (
        <div className="p-6 bg-red-900/20 border border-red-500/50 rounded-xl text-red-200 mb-6">
          <p className="font-bold mb-2">Erro ao conectar com o banco de dados:</p>
          <pre className="text-xs overflow-auto p-2 bg-black/40 rounded">{error}</pre>
          <p className="mt-4 text-sm opacity-80">Verifique se a tabela "perfis" existe no seu projeto Supabase e se as chaves no ambiente estão corretas.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#1a1a1a] text-gray-400 text-xs uppercase tracking-wider">
                <th className="p-4 text-left border-b border-gray-800">ID</th>
                <th className="p-4 text-left border-b border-gray-800">Avatar</th>
                <th className="p-4 text-left border-b border-gray-800">E-mail</th>
                <th className="p-4 text-left border-b border-gray-800">Nome Completo</th>
                <th className="p-4 text-left border-b border-gray-800">Organização</th>
                <th className="p-4 text-left border-b border-gray-800">Criado em</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {perfis.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 italic">Nenhum registro encontrado na tabela "perfis".</td>
                </tr>
              ) : (
                perfis.map((perfil) => (
                  <tr key={perfil.id} className="border-b border-gray-800/50 hover:bg-white/5 transition">
                    <td className="p-4 text-xs font-mono text-gray-500">{perfil.id}</td>
                    <td className="p-4">
                      {perfil.avatar_url ? (
                        <img src={perfil.avatar_url} alt="Avatar" className="w-8 h-8 rounded-full border border-gray-700 object-cover" />
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="p-4 font-medium">{perfil.email}</td>
                    <td className="p-4">{perfil.nome_completo}</td>
                    <td className="p-4 text-gray-400">{perfil.organizacao || '-'}</td>
                    <td className="p-4 text-xs text-gray-500">{new Date(perfil.criado_em).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-8">
        <button
          onClick={() => window.history.back()}
          className="bg-gray-800 px-4 py-2 rounded hover:bg-gray-700 transition"
        >
          Voltar
        </button>
      </div>
    </div>
  );
};
