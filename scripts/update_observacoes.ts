import { getPool } from '../api/clientes.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function updateObservacoes() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rowCount } = await client.query(
      `UPDATE "RCMOLINASEGUROS"."CLIENTES" SET observacoes_extras = $1`,
      ['Cliente Ficticio']
    );
    console.log(`Atualizados ${rowCount} clientes com a observação "Cliente Ficticio".`);
  } catch (err) {
    console.error('Erro ao atualizar observações:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

updateObservacoes();
