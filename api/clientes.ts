import express from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { Pool } from 'pg';
import { initLocalDatabase } from './_lib/local_db';

export const getPool = () => {
  const databaseUrl = process.env.DATABASE_URL || '';
  return new Pool(
    databaseUrl
      ? { connectionString: databaseUrl }
      : {
          host: process.env.PGHOST || '127.0.0.1',
          port: Number(process.env.PGPORT || 5432),
          database: process.env.PGDATABASE || 'rcmolina',
          user: process.env.PGUSER || 'rcmolina',
          password: process.env.PGPASSWORD || '',
        },
  );
};

type ClienteAnexoPayload = {
  nome?: string;
  name?: string;
  tamanho?: number;
  size?: number;
  tipoMime?: string;
  mimeType?: string;
  caminhoArquivo?: string;
  previewUrl?: string;
  dataUrl?: string;
};

type DbQueryable = {
  query: (text: string, params?: any[]) => Promise<any>;
};

const parseDateBR = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    throw new Error('Informe datas no formato dd/mm/aaaa.');
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error('Informe uma data valida.');
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const resolvePermiteAgendarOnline = (data: any) =>
  data.permiteAgendarOnline ?? data.permiteAgendamentoOnline ?? true;

const normalizeClienteCodigo = (value?: string | null) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 7);
  return digits ? digits.padStart(7, '0') : '0000000';
};

const gerarProximoCodigoCliente = async (client: DbQueryable) => {
  await client.query(`select pg_advisory_xact_lock(hashtext('RCMOLINASEGUROS.CLIENTES.codigo'))`);

  const maxResult = await client.query(`
    select coalesce(max(regexp_replace(codigo, '\\D', '', 'g')::integer), 0) as max_codigo
    from "RCMOLINASEGUROS"."CLIENTES"
    where codigo ~ '^\\d{1,7}$'
  `);

  let nextNumber = Number(maxResult.rows[0]?.max_codigo || 0) + 1;

  while (nextNumber <= 9999999) {
    const candidate = String(nextNumber).padStart(7, '0');
    const exists = await client.query(
      `select 1 from "RCMOLINASEGUROS"."CLIENTES" where codigo = $1 limit 1`,
      [candidate],
    );

    if (exists.rowCount === 0) {
      return candidate;
    }

    nextNumber += 1;
  }

  throw new Error('Não há códigos de cliente disponíveis.');
};

const sanitizeFileName = (name: string) => {
  const cleanName = name.trim().replace(/[\\/:*?"<>|]+/g, '-');
  return cleanName || 'anexo';
};

const extensionFromMime = (mime: string) => {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('svg')) return 'svg';
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  return 'bin';
};

const saveClienteAnexo = async (idCliente: string, anexo: ClienteAnexoPayload) => {
  const existingPath = anexo.caminhoArquivo || anexo.previewUrl;
  if (existingPath && existingPath.startsWith('/uploads/')) {
    return {
      nomeArquivo: sanitizeFileName(anexo.nome || anexo.name || path.basename(existingPath)),
      caminhoArquivo: existingPath,
      tamanhoBytes: Number(anexo.tamanho || anexo.size || 0) || null,
      tipoMime: anexo.tipoMime || anexo.mimeType || null,
    };
  }

  const match = String(anexo.dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;

  const [, mime, base64] = match;
  const buffer = Buffer.from(base64, 'base64');
  const originalName = sanitizeFileName(anexo.nome || anexo.name || `anexo.${extensionFromMime(mime)}`);
  const extension = path.extname(originalName) || `.${extensionFromMime(mime)}`;
  const filename = `${crypto.randomUUID()}${extension.toLowerCase()}`;
  const uploadRoot = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
  const clienteDir = path.join(uploadRoot, 'clientes', idCliente);

  await fs.mkdir(clienteDir, { recursive: true });
  await fs.writeFile(path.join(clienteDir, filename), buffer);

  return {
    nomeArquivo: originalName,
    caminhoArquivo: `/uploads/clientes/${idCliente}/${filename}`,
    tamanhoBytes: buffer.length,
    tipoMime: mime,
  };
};

const replaceClienteAnexos = async (client: any, idCliente: string, anexos: ClienteAnexoPayload[] = []) => {
  await client.query(`DELETE FROM "RCMOLINASEGUROS"."CLIENTES_ANEXOS" WHERE id_cliente = $1`, [idCliente]);

  for (const anexo of anexos) {
    const saved = await saveClienteAnexo(idCliente, anexo);
    if (!saved) continue;

    await client.query(
      `INSERT INTO "RCMOLINASEGUROS"."CLIENTES_ANEXOS"
       (id_cliente, nome_arquivo, caminho_arquivo, tamanho_bytes, tipo_mime)
       VALUES ($1, $2, $3, $4, $5)`,
      [idCliente, saved.nomeArquivo, saved.caminhoArquivo, saved.tamanhoBytes, saved.tipoMime],
    );
  }
};

const clienteSelect = `
  SELECT c.*,
    COALESCE((SELECT json_agg(row_to_json(cc)) FROM "RCMOLINASEGUROS"."CLIENTES_CONTATOS" cc WHERE cc.id_cliente = c.id_cliente), '[]'::json) as contatos,
    COALESCE((SELECT json_agg(row_to_json(ca)) FROM "RCMOLINASEGUROS"."CLIENTES_ANEXOS" ca WHERE ca.id_cliente = c.id_cliente), '[]'::json) as anexos
  FROM "RCMOLINASEGUROS"."CLIENTES" c
`;

export const createClienteHandler = async (req: express.Request, res: express.Response) => {
  await initLocalDatabase();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const data = req.body;

    const dataCadastro = parseDateBR(data.dataCadastro);
    const dataAtualizacao = parseDateBR(data.dataAtualizacao);
    const isAutoGeneratedCode = data.codigoAutoGerado === true || !String(data.codigo || '').trim();
    const clienteCodigo = isAutoGeneratedCode ? await gerarProximoCodigoCliente(client) : normalizeClienteCodigo(data.codigo);

    if (!isAutoGeneratedCode) {
      const existingCode = await client.query(
        `select 1 from "RCMOLINASEGUROS"."CLIENTES" where codigo = $1 limit 1`,
        [clienteCodigo],
      );

      if (existingCode.rowCount && existingCode.rowCount > 0) {
        await client.query('ROLLBACK');
        res.status(409).json({ error: 'Este código já está cadastrado em outro cliente.' });
        return;
      }
    }

    const clienteResult = await client.query(
      `INSERT INTO "RCMOLINASEGUROS"."CLIENTES" 
       (nome_completo, cpf, rg, cnpj, data_nascimento, status_cliente, codigo, data_cadastro, data_atualizacao, cep, logradouro, numero, complemento, ponto_referencia, bairro, cidade, uf, observacoes_extras, como_conheceu, produto_comercializado, status_negociacao, valor_proposta, numero_proposta, forma_pagamento, data_fechamento, permite_agendar_online, documentacao_anotacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::date, current_date), COALESCE($9::date, current_date), $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
       RETURNING id_cliente`,
      [
        data.nome || '',
        data.cpf || null,
        data.rg || null,
        data.cnpj || null,
        parseDateBR(data.dataNascimento),
        data.status || 'ATIVO',
        clienteCodigo,
        dataCadastro,
        dataAtualizacao,
        data.enderecoCep || null,
        data.enderecoRua || null,
        data.enderecoNumero || null,
        data.enderecoComplemento || null,
        data.enderecoReferencia || null,
        data.enderecoBairro || null,
        data.enderecoCidade || null,
        data.enderecoEstado || null,
        data.observacoes || null,
        data.comoConheceu || '0 - Nao informado',
        data.produtoComercializado || null,
        data.statusNegociacao || null,
        data.valorProposta || null,
        data.numeroProposta || null,
        data.formaPagamento || null,
        parseDateBR(data.dataFechamento),
        resolvePermiteAgendarOnline(data) !== false,
        data.documentacao || null
      ]
    );

    const idCliente = clienteResult.rows[0].id_cliente;

    if (data.contatos && Array.isArray(data.contatos)) {
      for (const contato of data.contatos) {
        if (!contato.value) continue;
        await client.query(
          `INSERT INTO "RCMOLINASEGUROS"."CLIENTES_CONTATOS"
           (id_cliente, tipo, valor, complemento, observacoes, preferencial)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            idCliente,
            contato.type,
            contato.value,
            contato.extra || null,
            contato.notes || null,
            contato.favorite || false
          ]
        );
      }
    }

    await replaceClienteAnexos(client, idCliente, Array.isArray(data.anexos) ? data.anexos : []);

    await client.query('COMMIT');
    res.json({ success: true, id_cliente: idCliente });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating cliente:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

export const listClientesHandler = async (req: express.Request, res: express.Response) => {
  await initLocalDatabase();
  const pool = getPool();
  try {
    const result = await pool.query(`
      ${clienteSelect}
      ORDER BY data_cadastro DESC
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error listing clientes:', error);
    res.status(500).json({ error: error.message });
  }
};

export const nextClienteCodigoHandler = async (_req: express.Request, res: express.Response) => {
  await initLocalDatabase();
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const codigo = await gerarProximoCodigoCliente(client);
    await client.query('COMMIT');
    res.json({ codigo });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error generating cliente codigo:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

export const aniversariantesMesHandler = async (_req: express.Request, res: express.Response) => {
  await initLocalDatabase();
  const pool = getPool();

  try {
    const result = await pool.query(`
      select
        codigo,
        nome_completo,
        cpf,
        data_nascimento,
        cidade,
        uf,
        status_cliente
      from "RCMOLINASEGUROS"."CLIENTES"
      where data_nascimento is not null
      order by extract(month from data_nascimento), extract(day from data_nascimento), nome_completo
    `);

    res.json(result.rows);
  } catch (error: any) {
    console.error('Error listing aniversariantes do mes:', error);
    res.status(500).json({ error: error.message });
  }
};

export const searchClientesHandler = async (req: express.Request, res: express.Response) => {
  await initLocalDatabase();
  const pool = getPool();
  const query = req.query.q as string;
  
  if (!query || query.trim().length < 2) {
    return res.json([]);
  }

  try {
    const searchTerm = `%${query.trim()}%`;
    const result = await pool.query(`
      ${clienteSelect}
      WHERE unaccent(c.nome_completo) ILIKE unaccent($1) 
         OR c.codigo ILIKE $1
         OR c.cpf ILIKE $1
         OR c.cnpj ILIKE $1
         OR EXISTS (
           SELECT 1 FROM "RCMOLINASEGUROS"."CLIENTES_CONTATOS" ct
           WHERE ct.id_cliente = c.id_cliente AND unaccent(ct.valor) ILIKE unaccent($1)
         )
      ORDER BY c.data_cadastro DESC
      LIMIT 15
    `, [searchTerm]);
    
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error searching clientes:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteClienteHandler = async (req: express.Request, res: express.Response) => {
  await initLocalDatabase();
  const pool = getPool();
  const client = await pool.connect();
  const { id } = req.params;
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM "RCMOLINASEGUROS"."CLIENTES_CONTATOS" WHERE id_cliente = $1`, [id]);
    await client.query(`DELETE FROM "RCMOLINASEGUROS"."CLIENTES_ANEXOS" WHERE id_cliente = $1`, [id]);
    const result = await client.query(`DELETE FROM "RCMOLINASEGUROS"."CLIENTES" WHERE id_cliente = $1 RETURNING id_cliente`, [id]);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    await client.query('COMMIT');
    res.json({ success: true, id_cliente: id });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error deleting cliente:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

export const updateClienteHandler = async (req: express.Request, res: express.Response) => {
  await initLocalDatabase();
  const pool = getPool();
  const client = await pool.connect();
  const { id } = req.params;

  try {
    await client.query('BEGIN');
    const data = req.body;

    const dataCadastro = parseDateBR(data.dataCadastro);
    const dataAtualizacao = parseDateBR(data.dataAtualizacao);

    await client.query(
      `UPDATE "RCMOLINASEGUROS"."CLIENTES" SET 
        nome_completo = $1, cpf = $2, rg = $3, cnpj = $4, data_nascimento = $5,
        status_cliente = $6, codigo = $7, data_cadastro = COALESCE($8::date, data_cadastro),
        data_atualizacao = COALESCE($9::date, current_date), cep = $10, logradouro = $11, numero = $12,
        complemento = $13, ponto_referencia = $14, bairro = $15, cidade = $16, uf = $17,
        observacoes_extras = $18, como_conheceu = $19, produto_comercializado = $20,
        status_negociacao = $21, valor_proposta = $22, numero_proposta = $23,
        forma_pagamento = $24, data_fechamento = $25, permite_agendar_online = $26,
        documentacao_anotacoes = $27
       WHERE id_cliente = $28`,
      [
        data.nome || '',
        data.cpf || null,
        data.rg || null,
        data.cnpj || null,
        parseDateBR(data.dataNascimento),
        data.status || 'ATIVO',
        normalizeClienteCodigo(data.codigo),
        dataCadastro,
        dataAtualizacao,
        data.enderecoCep || null,
        data.enderecoRua || null,
        data.enderecoNumero || null,
        data.enderecoComplemento || null,
        data.enderecoReferencia || null,
        data.enderecoBairro || null,
        data.enderecoCidade || null,
        data.enderecoEstado || null,
        data.observacoes || null,
        data.comoConheceu || '0 - Nao informado',
        data.produtoComercializado || null,
        data.statusNegociacao || null,
        data.valorProposta || null,
        data.numeroProposta || null,
        data.formaPagamento || null,
        parseDateBR(data.dataFechamento),
        resolvePermiteAgendarOnline(data) !== false,
        data.documentacao || null,
        id
      ]
    );

    await client.query(`DELETE FROM "RCMOLINASEGUROS"."CLIENTES_CONTATOS" WHERE id_cliente = $1`, [id]);

    if (data.contatos && Array.isArray(data.contatos)) {
      for (const contato of data.contatos) {
        if (!contato.value) continue;
        await client.query(
          `INSERT INTO "RCMOLINASEGUROS"."CLIENTES_CONTATOS"
           (id_cliente, tipo, valor, complemento, observacoes, preferencial)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            id,
            contato.type,
            contato.value,
            contato.extra || null,
            contato.notes || null,
            contato.favorite || false
          ]
        );
      }
    }

    await replaceClienteAnexos(client, id, Array.isArray(data.anexos) ? data.anexos : []);

    await client.query('COMMIT');
    res.json({ success: true, id_cliente: id });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error updating cliente:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

export const clientStatsHandler = async (_req: express.Request, res: express.Response) => {
  await initLocalDatabase();
  const pool = getPool();
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status_cliente = 'ATIVO' OR status_cliente IS NULL OR status_cliente = '') as ativos,
        COUNT(*) FILTER (WHERE status_cliente = 'INATIVO') as inativos
      FROM "RCMOLINASEGUROS"."CLIENTES"
    `);
    
    const stats = result.rows[0] || { total: 0, ativos: 0, inativos: 0 };
    res.json({
      total: Number(stats.total),
      ativos: Number(stats.ativos),
      inativos: Number(stats.inativos)
    });
  } catch (error: any) {
    console.error('Error getting client stats:', error);
    res.status(500).json({ error: error.message });
  }
};

export const checkClienteCodigoHandler = async (req: express.Request, res: express.Response) => {
  await initLocalDatabase();
  const pool = getPool();
  const { codigo } = req.params;

  try {
    const normalizedCodigo = normalizeClienteCodigo(codigo);
    const result = await pool.query(
      `SELECT id_cliente FROM "RCMOLINASEGUROS"."CLIENTES" WHERE codigo = $1 LIMIT 1`,
      [normalizedCodigo]
    );

    res.json({ exists: result.rowCount ? result.rowCount > 0 : false });
  } catch (error: any) {
    console.error('Error checking cliente codigo:', error);
    res.status(500).json({ error: error.message });
  }
};
