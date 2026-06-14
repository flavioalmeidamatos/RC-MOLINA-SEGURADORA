import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const run = async () => {
  const databaseUrl = process.env.DATABASE_URL || '';
  const pool = new Pool(
    databaseUrl
      ? { connectionString: databaseUrl }
      : {
          host: process.env.PGHOST || '127.0.0.1',
          port: Number(process.env.PGPORT || 5432),
          database: process.env.PGDATABASE || 'rcmolina',
          user: process.env.PGUSER || 'rcmolina',
          password: process.env.PGPASSWORD || '',
        }
  );

  try {
    const res = await pool.query('SELECT id, email, nome_completo, company_id, is_master_admin FROM "RCMOLINASEGUROS"."USUARIOS"');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
};

run();
