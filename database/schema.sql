-- ============================================================================
-- RC MOLINA SEGURADORA — Schema Consolidado de Referência
-- ============================================================================
-- Este arquivo é apenas REFERÊNCIA. As tabelas e funções já existem no 
-- Supabase (produção). NÃO execute este arquivo diretamente.
-- ============================================================================

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ TABELAS                                                                  │
-- └──────────────────────────────────────────────────────────────────────────┘

-- 1. Tabela de Usuários
CREATE TABLE IF NOT EXISTS "RCMOLINASEGUROS"."USUARIOS" (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    senha_hash    TEXT NOT NULL,
    nome_completo TEXT NOT NULL,
    organizacao   TEXT,
    avatar_url    TEXT,
    criado_em     TIMESTAMPTZ DEFAULT now(),
    atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de Auditoria
CREATE TABLE IF NOT EXISTS "RCMOLINASEGUROS"."AUDITORIA" (
    id         BIGSERIAL PRIMARY KEY,
    acao       TEXT NOT NULL,
    detalhes   JSONB DEFAULT '{}',
    criado_em  TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabela de Códigos de Login (OTP)
CREATE TABLE IF NOT EXISTS "RCMOLINASEGUROS"."CODIGOS_LOGIN" (
    id            BIGSERIAL PRIMARY KEY,
    usuario_id    UUID NOT NULL REFERENCES "RCMOLINASEGUROS"."USUARIOS"(id) ON DELETE CASCADE,
    codigo        TEXT NOT NULL,
    tentativas    INT DEFAULT 0,
    max_tentativas INT DEFAULT 5,
    criado_em     TIMESTAMPTZ DEFAULT now(),
    expira_em     TIMESTAMPTZ DEFAULT (now() + INTERVAL '10 minutes'),
    usado         BOOLEAN DEFAULT FALSE
);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ RPCs (Funções SECURITY DEFINER)                                          │
-- └──────────────────────────────────────────────────────────────────────────┘

-- usuarios_cadastrar(p_email, p_senha, p_nome_completo, p_organizacao, p_avatar_url)
-- usuarios_login(p_email, p_senha)
-- usuarios_perfil(p_id)
-- usuarios_email_existe(p_email) → boolean
-- usuarios_gerar_codigo_login(p_email) → código OTP (rate limit 60s)
-- usuarios_verificar_codigo_login(p_email, p_codigo) → perfil
-- usuarios_resetar_senha_com_codigo(p_email, p_codigo, p_nova_senha) → status JSON

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ SEGURANÇA                                                                │
-- └──────────────────────────────────────────────────────────────────────────┘

-- • Todas as RPCs usam SECURITY DEFINER
-- • Rate limiting de 60s no gerador de OTP
-- • Reset de senha atômico (verifica OTP + atualiza senha em transação)
-- • Anti-enumeração (API sempre retorna 200)
-- • Máximo 5 tentativas por código OTP
-- • Expiração de 10 minutos para códigos OTP
