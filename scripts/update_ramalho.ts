import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || '127.0.0.1',
        port: Number(process.env.PGPORT || 5432),
        database: process.env.PGDATABASE || 'rcmolina',
        user: process.env.PGUSER || 'rcmolina',
        password: process.env.PGPASSWORD || '',
      }
);

async function run() {
  try {
    console.log('Executando query para atualizar os clientes...');
    const res = await pool.query(`
      UPDATE "RCMOLINASEGUROS"."CLIENTES"
      SET como_conheceu = '6 - Lead'
      WHERE nome_completo ILIKE '%- REMALHO%'
         OR observacoes_extras ILIKE '%- REMALHO%'
         OR documentacao_anotacoes ILIKE '%- REMALHO%';
    `);
    console.log("Sucesso: " + res.rowCount + " registros atualizados para '6 - Lead'.");
  } catch (error) {
    console.error('Erro ao atualizar:', error);
  } finally {
    await pool.end();
  }
}

run();
