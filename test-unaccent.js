const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/rcmolinaseguros' });
pool.query("SELECT unaccent('João') AS test")
  .then(res => console.log(res.rows))
  .catch(console.error)
  .finally(() => pool.end());
