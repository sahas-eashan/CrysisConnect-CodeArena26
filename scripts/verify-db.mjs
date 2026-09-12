import pg from "pg";

const { Client } = pg;

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

try {
  await client.connect();

  const tables = await client.query(
    "select count(*)::int as count from information_schema.tables where table_schema = 'public'"
  );
  const disasters = await client.query("select count(*)::int as count from disasters");
  const safeZones = await client.query("select count(*)::int as count from safe_zones");
  const resources = await client.query("select count(*)::int as count from resources");

  console.log(
    JSON.stringify(
      {
        tables: tables.rows[0].count,
        disasters: disasters.rows[0].count,
        safeZones: safeZones.rows[0].count,
        resources: resources.rows[0].count
      },
      null,
      2
    )
  );
} finally {
  await client.end();
}
