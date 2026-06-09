import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Client } = pg;

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("Connected to the database");
    
    // Execute the deletion
    const res = await client.query("DELETE FROM clientes WHERE nome ILIKE '%remalho%' RETURNING id, nome");
    console.log(`Deleted ${res.rowCount} clients.`);
    res.rows.forEach(row => {
      console.log(`- Deleted: [${row.id}] ${row.nome}`);
    });
  } catch (error) {
    console.error("Error executing query", error);
  } finally {
    await client.end();
  }
}

run();
