const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://rcmolinaseguros:m1L2x3J4@193.203.175.148:5432/rcmolinaseguros',
});

async function check() {
  await client.connect();
  const res = await client.query(`
    SELECT c.id_cliente, c.nome_completo, 
      (SELECT valor FROM "RCMOLINASEGUROS"."CLIENTES_CONTATOS" cc WHERE cc.id_cliente = c.id_cliente AND tipo = 'Celular' LIMIT 1) as fone 
    FROM "RCMOLINASEGUROS"."CLIENTES" c 
    ORDER BY c.id_cliente DESC 
    LIMIT 10
  `);
  console.table(res.rows);
  await client.end();
}

check().catch(console.error);
