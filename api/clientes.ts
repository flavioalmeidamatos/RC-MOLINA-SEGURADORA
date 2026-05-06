import express from 'express';
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

export const createClienteHandler = async (req: express.Request, res: express.Response) => {
  await initLocalDatabase();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const data = req.body;

    const clienteResult = await client.query(
      `INSERT INTO "RCMOLINASEGUROS"."CLIENTES" 
       (nome_completo, cpf, rg, cnpj, data_nascimento, codigo, cep, logradouro, numero, complemento, bairro, cidade, uf, observacoes_extras, permite_agendar_online, documentacao_anotacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING id_cliente`,
      [
        data.nome || '',
        data.cpf || null,
        data.rg || null,
        data.cnpj || null,
        data.dataNascimento ? data.dataNascimento.split('/').reverse().join('-') : null,
        data.codigo || '000000',
        data.enderecoCep || null,
        data.enderecoRua || null,
        data.enderecoNumero || null,
        data.enderecoComplemento || null,
        data.enderecoBairro || null,
        data.enderecoCidade || null,
        data.enderecoEstado || null,
        data.observacoes || null,
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
      SELECT c.*, 
        COALESCE((SELECT json_agg(row_to_json(cc)) FROM "RCMOLINASEGUROS"."CLIENTES_CONTATOS" cc WHERE cc.id_cliente = c.id_cliente), '[]'::json) as contatos
      FROM "RCMOLINASEGUROS"."CLIENTES" c
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
      SELECT c.*, 
        COALESCE((SELECT json_agg(row_to_json(cc)) FROM "RCMOLINASEGUROS"."CLIENTES_CONTATOS" cc WHERE cc.id_cliente = c.id_cliente), '[]'::json) as contatos
      FROM "RCMOLINASEGUROS"."CLIENTES" c
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

    await client.query(
      `UPDATE "RCMOLINASEGUROS"."CLIENTES" SET 
        nome_completo = $1, cpf = $2, rg = $3, cnpj = $4, data_nascimento = $5,
        codigo = $6, cep = $7, logradouro = $8, numero = $9, complemento = $10,
        bairro = $11, cidade = $12, uf = $13, observacoes_extras = $14,
        permite_agendar_online = $15, documentacao_anotacoes = $16,
        data_atualizacao = timezone('utc', now())
       WHERE id_cliente = $17`,
      [
        data.nome || '',
        data.cpf || null,
        data.rg || null,
        data.cnpj || null,
        data.dataNascimento ? data.dataNascimento.split('/').reverse().join('-') : null,
        data.codigo || '000000',
        data.enderecoCep || null,
        data.enderecoRua || null,
        data.enderecoNumero || null,
        data.enderecoComplemento || null,
        data.enderecoBairro || null,
        data.enderecoCidade || null,
        data.enderecoEstado || null,
        data.observacoes || null,
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

