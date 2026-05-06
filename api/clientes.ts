import express from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { Pool } from 'pg';
import { initLocalDatabase } from './_lib/local_db';

const getPool = () => {
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

    const clienteResult = await client.query(
      `INSERT INTO "RCMOLINASEGUROS"."CLIENTES" 
       (nome_completo, cpf, rg, cnpj, data_nascimento, status_cliente, codigo, data_cadastro, data_atualizacao, cep, logradouro, numero, complemento, ponto_referencia, bairro, cidade, uf, observacoes_extras, marcacoes, como_conheceu, permite_agendar_online, documentacao_anotacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::date, current_date), COALESCE($9::date, current_date), $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
       RETURNING id_cliente`,
      [
        data.nome || '',
        data.cpf || null,
        data.rg || null,
        data.cnpj || null,
        parseDateBR(data.dataNascimento),
        data.status || 'ATIVO',
        data.codigo || '000000',
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
        data.marcacoes || null,
        data.comoConheceu || '0 - Nao informado',
        data.permiteAgendamentoOnline !== false,
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

export const searchClientesHandler = async (req: express.Request, res: express.Response) => {
  await initLocalDatabase();
  const pool = getPool();
  const query = req.query.q as string;
  
  if (!query || query.trim().length < 2) {
    return res.json([]);
  }

  try {
    const searchTerm = `%${query.trim().toLowerCase()}%`;
    const result = await pool.query(`
      ${clienteSelect}
      WHERE lower(c.nome_completo) LIKE $1 
         OR c.codigo LIKE $1
         OR c.cpf LIKE $1
         OR c.cnpj LIKE $1
         OR EXISTS (
           SELECT 1 FROM "RCMOLINASEGUROS"."CLIENTES_CONTATOS" ct
           WHERE ct.id_cliente = c.id_cliente AND ct.valor LIKE $1
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
        observacoes_extras = $18, marcacoes = $19, como_conheceu = $20,
        permite_agendar_online = $21, documentacao_anotacoes = $22
       WHERE id_cliente = $23`,
      [
        data.nome || '',
        data.cpf || null,
        data.rg || null,
        data.cnpj || null,
        parseDateBR(data.dataNascimento),
        data.status || 'ATIVO',
        data.codigo || '000000',
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
        data.marcacoes || null,
        data.comoConheceu || '0 - Nao informado',
        data.permiteAgendamentoOnline !== false,
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
