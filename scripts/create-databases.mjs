import { Client } from "pg";

const databaseNames = ["skyline_dev", "skyline_test", "skyline_shadow"];

const adminUrl =
  process.env.POSTGRES_ADMIN_URL ??
  "postgresql://postgres:postgres@localhost:5432/postgres";

function assertSafeDatabaseName(name) {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe database name: ${name}`);
  }
}

async function main() {
  const client = new Client({ connectionString: adminUrl });
  await client.connect();

  try {
    for (const databaseName of databaseNames) {
      assertSafeDatabaseName(databaseName);

      const existing = await client.query(
        "select 1 from pg_database where datname = $1",
        [databaseName],
      );

      if (existing.rowCount) {
        console.log(`Database already exists: ${databaseName}`);
        continue;
      }

      await client.query(`create database ${databaseName}`);
      console.log(`Created database: ${databaseName}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

