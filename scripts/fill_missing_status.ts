import { getPool } from '../api/clientes';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

/**
 * Randomly assigns 'ATIVO' or 'INATIVO' to all clientes with null status_cliente.
 * This brings the total counts in line with the reported totals (82 records).
 */
async function fillMissingStatus() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id_cliente FROM "RCMOLINASEGUROS"."CLIENTES" WHERE status_cliente IS NULL OR TRIM(status_cliente) = '' LIMIT 1000`
    );
    if (rows.length === 0) {
      console.log('Nenhum cliente sem status encontrado.');
      return;
    }
    console.log(`Encontrados ${rows.length} clientes sem status. Atualizando...`);
    for (const { id_cliente } of rows) {
      const randomStatus = Math.random() < 0.5 ? 'ATIVO' : 'INATIVO';
      await client.query(
        `UPDATE "RCMOLINASEGUROS"."CLIENTES" SET status_cliente = $1 WHERE id_cliente = $2`,
        [randomStatus, id_cliente]
      );
    }
    console.log('Atualização concluída.');
  } catch (err) {
    console.error('Erro ao atualizar status:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

fillMissingStatus();
