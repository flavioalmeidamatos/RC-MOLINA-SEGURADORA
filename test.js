import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
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

pool.query('SELECT nome_completo, codigo, status_cliente FROM "RCMOLINASEGUROS"."CLIENTES" ORDER BY data_cadastro DESC LIMIT 5').then(res => {
  console.log(res.rows);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
