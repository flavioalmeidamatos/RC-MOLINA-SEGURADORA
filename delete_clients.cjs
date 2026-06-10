const { Pool } = require('pg');
require('dotenv').config({path: '.env'});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    const res = await pool.query("DELETE FROM clientes WHERE nome_completo LIKE '%- REMALHO%'");
    console.log('Deleted rows:', res.rowCount);
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

run();
