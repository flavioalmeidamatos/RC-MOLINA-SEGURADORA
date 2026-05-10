import { getPool } from '../api/clientes';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function checkStatus() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT status_cliente, COUNT(*) FROM "RCMOLINASEGUROS"."CLIENTES" GROUP BY status_cliente`
    );
    console.log('Status Distribution:');
    console.table(rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

checkStatus();
