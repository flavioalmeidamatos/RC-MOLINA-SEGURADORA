import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://rcmolina:RULwtaBjtw2sxbEpcP24PWZQuAjCaumq@187.77.55.45:5432/rcmolina'
});

async function run() {
  try {
    const res = await pool.query("DELETE FROM \"RCMOLINASEGUROS\".\"CLIENTES\" WHERE nome_completo LIKE '% - REMALHO%'");
    console.log('Deleted rows:', res.rowCount);
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

run();
