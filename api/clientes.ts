import express from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { Pool } from 'pg';
import { initLocalDatabase } from './_lib/local_db';
import { getTenantContext } from './_lib/tenant_context';

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
  if (!digits || /^0+$/.test(digits)) return '';
  return digits.padStart(7, '0');
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

    const context = await getTenantContext(req);
    const targetUserId = context.userId || context.currentUserId;

    const clienteResult = await client.query(
      `INSERT INTO "RCMOLINASEGUROS"."CLIENTES" 
       (nome_completo, cpf, rg, cnpj, data_nascimento, status_cliente, codigo, data_cadastro, data_atualizacao, cep, logradouro, numero, complemento, ponto_referencia, bairro, cidade, uf, observacoes_extras, como_conheceu, produto_comercializado, status_negociacao, valor_proposta, numero_proposta, forma_pagamento, data_fechamento, permite_agendar_online, documentacao_anotacoes, idade, company_id, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::date, current_date), COALESCE($9::date, current_date), $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
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
        data.documentacao || null,
        data.idade || null,
        context.companyId,
        targetUserId
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

export const addClienteAnexoHandler = async (req: express.Request, res: express.Response) => {
  await initLocalDatabase();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const idCliente = req.params.id;
    const anexo = req.body;
    
    const saved = await saveClienteAnexo(idCliente, anexo);
    if (!saved) return res.status(400).json({ error: 'Falha ao salvar anexo' });

    await client.query(
      `INSERT INTO "RCMOLINASEGUROS"."CLIENTES_ANEXOS"
       (id_cliente, nome_arquivo, caminho_arquivo, tamanho_bytes, tipo_mime)
       VALUES ($1, $2, $3, $4, $5)`,
      [idCliente, saved.nomeArquivo, saved.caminhoArquivo, saved.tamanhoBytes, saved.tipoMime],
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error adding anexo:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

export const listClientesHandler = async (req: express.Request, res: express.Response) => {
  await initLocalDatabase();
  const pool = getPool();
  try {
    const context = await getTenantContext(req);
    let queryText = clienteSelect;
    const params: any[] = [context.companyId];

    queryText += ' WHERE c.company_id = $1';

    if (context.userId) {
      queryText += ' AND c.usuario_id = $2';
      params.push(context.userId);
    }

    queryText += ' ORDER BY data_cadastro DESC LIMIT 10';

    const result = await pool.query(queryText, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error listing clientes:', error);
    res.status(500).json({ error: error.message });
  }
};

export const listClientesByStatusHandler = async (req: express.Request, res: express.Response) => {
  await initLocalDatabase();
  const pool = getPool();
  try {
    const status = req.query.s as string;
    if (!status || (status !== 'ATIVO' && status !== 'INATIVO')) {
      return res.status(400).json({ error: 'Status inválido' });
    }
    const context = await getTenantContext(req);
    let queryText = `${clienteSelect} WHERE status_cliente = $1 AND c.company_id = $2`;
    const params: any[] = [status, context.companyId];

    if (context.userId) {
      queryText += ' AND c.usuario_id = $3';
      params.push(context.userId);
    }

    queryText += ' ORDER BY nome_completo ASC';

    const result = await pool.query(queryText, params);
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

export const aniversariantesMesHandler = async (req: express.Request, res: express.Response) => {
  await initLocalDatabase();
  const pool = getPool();

  try {
    const context = await getTenantContext(req);
    let queryText = `
      select
        codigo,
        nome_completo,
        cpf,
        data_nascimento,
        cidade,
        uf,
        status_cliente
      from "RCMOLINASEGUROS"."CLIENTES"
      where data_nascimento is not null AND company_id = $1
    `;
    const params: any[] = [context.companyId];

    if (context.userId) {
      queryText += ' AND usuario_id = $2';
      params.push(context.userId);
    }

    queryText += ' order by extract(month from data_nascimento), extract(day from data_nascimento), nome_completo';

    const result = await pool.query(queryText, params);

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
  const campaign = req.query.campaign as string | undefined;
  const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : 15;
  const limit = isNaN(limitParam) ? 15 : Math.min(Math.max(1, limitParam), 5000);
  
  if (!query || query.trim().length < 2) {
    return res.json([]);
  }

  try {
    const context = await getTenantContext(req);
    const searchTerm = `%${query.trim()}%`;
    const params: any[] = [searchTerm, limit, context.companyId];
    let queryText = `
      ${clienteSelect}
      WHERE (
         c.nome_completo ILIKE $1 
         OR c.codigo ILIKE $1
         OR c.cpf ILIKE $1
         OR c.cnpj ILIKE $1
         OR EXISTS (
           SELECT 1 FROM "RCMOLINASEGUROS"."CLIENTES_CONTATOS" ct
           WHERE ct.id_cliente = c.id_cliente 
             AND (
               ct.valor ILIKE $1 
               OR regexp_replace(ct.valor, '\\D', '', 'g') ILIKE $1
               OR (CASE WHEN regexp_replace(ct.valor, '\\D', '', 'g') LIKE '55%' THEN substring(regexp_replace(ct.valor, '\\D', '', 'g') from 3) ELSE regexp_replace(ct.valor, '\\D', '', 'g') END) ILIKE (CASE WHEN $1 LIKE '%55%' THEN replace($1, '55', '') ELSE $1 END)
             )
         )
      )
      AND c.company_id = $3
    `;

    if (context.userId) {
      params.push(context.userId);
      queryText += ` AND c.usuario_id = $${params.length}`;
    }

    if (campaign && campaign.trim() !== '') {
      params.push(`%${campaign.trim()}%`);
      queryText += ` AND (c.documentacao_anotacoes IS NULL OR c.documentacao_anotacoes NOT ILIKE $${params.length})`;
    }

    queryText += ` ORDER BY c.nome_completo ASC LIMIT $2`;

    const result = await pool.query(queryText, params);
    
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

    const context = await getTenantContext(req);
    const targetUserId = context.userId || context.currentUserId;

    await client.query(
      `UPDATE "RCMOLINASEGUROS"."CLIENTES" SET 
        nome_completo = $1, cpf = $2, rg = $3, cnpj = $4, data_nascimento = $5,
        status_cliente = $6, codigo = $7, data_cadastro = COALESCE($8::date, data_cadastro),
        data_atualizacao = COALESCE($9::date, current_date), cep = $10, logradouro = $11, numero = $12,
        complemento = $13, ponto_referencia = $14, bairro = $15, cidade = $16, uf = $17,
        observacoes_extras = $18, como_conheceu = $19, produto_comercializado = $20,
        status_negociacao = $21, valor_proposta = $22, numero_proposta = $23,
        forma_pagamento = $24, data_fechamento = $25, permite_agendar_online = $26,
        documentacao_anotacoes = $27, idade = $29,
        company_id = COALESCE(company_id, $30),
        usuario_id = COALESCE(usuario_id, $31)
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
        id,
        data.idade || null,
        context.companyId,
        targetUserId
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

export const clientStatsHandler = async (req: express.Request, res: express.Response) => {
  await initLocalDatabase();
  const pool = getPool();
  try {
    const context = await getTenantContext(req);
    let queryText = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status_cliente = 'ATIVO' OR status_cliente IS NULL OR status_cliente = '') as ativos,
        COUNT(*) FILTER (WHERE status_cliente = 'INATIVO') as inativos,
        COUNT(*) FILTER (WHERE como_conheceu = '6 - Lead') as leads
      FROM "RCMOLINASEGUROS"."CLIENTES"
      WHERE company_id = $1
    `;
    const params: any[] = [context.companyId];

    if (context.userId) {
      queryText += ' AND usuario_id = $2';
      params.push(context.userId);
    }

    const result = await pool.query(queryText, params);
    
    const stats = result.rows[0] || { total: 0, ativos: 0, inativos: 0, leads: 0 };
    res.json({
      total: Number(stats.total),
      ativos: Number(stats.ativos),
      inativos: Number(stats.inativos),
      leads: Number(stats.leads || 0)
    });
  } catch (error: any) {
    console.error('Error getting client stats:', error);
    res.status(500).json({ error: error.message });
  }
};

export const clientProdutosStatsHandler = async (req: express.Request, res: express.Response) => {
  await initLocalDatabase();
  const pool = getPool();
  try {
    const context = await getTenantContext(req);
    let queryText = `
      SELECT 
        produto_comercializado as produto,
        COUNT(*) as quantidade
      FROM "RCMOLINASEGUROS"."CLIENTES"
      WHERE produto_comercializado IS NOT NULL AND produto_comercializado != '' AND company_id = $1
    `;
    const params: any[] = [context.companyId];

    if (context.userId) {
      queryText += ' AND usuario_id = $2';
      params.push(context.userId);
    }

    queryText += `
      GROUP BY produto_comercializado
      ORDER BY quantidade DESC
    `;

    const result = await pool.query(queryText, params);
    
    // Converte quantidade para Number
    const data = result.rows.map(row => ({
      produto: row.produto,
      quantidade: Number(row.quantidade)
    }));
    
    res.json(data);
  } catch (error: any) {
    console.error('Error getting client produtos stats:', error);
    res.status(500).json({ error: error.message });
  }
};

export const clientNegociacaoStatsHandler = async (req: express.Request, res: express.Response) => {
  await initLocalDatabase();
  const pool = getPool();
  try {
    const context = await getTenantContext(req);
    let queryText = `
      SELECT 
        status_negociacao as status,
        COUNT(*) as quantidade
      FROM "RCMOLINASEGUROS"."CLIENTES"
      WHERE status_negociacao IS NOT NULL AND status_negociacao != '' AND company_id = $1
    `;
    const params: any[] = [context.companyId];

    if (context.userId) {
      queryText += ' AND usuario_id = $2';
      params.push(context.userId);
    }

    queryText += `
      GROUP BY status_negociacao
      ORDER BY quantidade DESC
    `;

    const result = await pool.query(queryText, params);
    
    // Converte quantidade para Number
    const data = result.rows.map(row => ({
      status: row.status,
      quantidade: Number(row.quantidade)
    }));
    
    res.json(data);
  } catch (error: any) {
    console.error('Error getting client negociacao stats:', error);
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

export const listClientesByNegociacaoHandler = async (req: express.Request, res: express.Response) => {
  await initLocalDatabase();
  const pool = getPool();
  try {
    const status = req.query.status as string;
    if (!status) {
      return res.status(400).json({ error: 'Status de negociação é obrigatório' });
    }
    const context = await getTenantContext(req);
    let queryText = `
      ${clienteSelect}
      WHERE status_negociacao = $1 AND c.company_id = $2
    `;
    const params: any[] = [status, context.companyId];

    if (context.userId) {
      queryText += ' AND c.usuario_id = $3';
      params.push(context.userId);
    }

    queryText += ' ORDER BY nome_completo ASC';

    const result = await pool.query(queryText, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error listing clientes by negociacao:', error);
    res.status(500).json({ error: error.message });
  }
};

