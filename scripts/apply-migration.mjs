// Applies supabase/migrations/*.sql to the Supabase Postgres database.
// Tries the direct connection first, then the IPv4 pooler across regions,
// so it works whether or not this machine has IPv6 routing.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "supabase", "migrations");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const password = process.env.SUPABASE_PASSWORD;
if (!url || !password) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_PASSWORD in .env.local");
  process.exit(1);
}
const ref = new URL(url).hostname.split(".")[0];

const poolerRegions = [
  "ap-southeast-2", // Sydney (most likely)
  "us-east-1",
  "us-west-1",
  "eu-central-1",
  "ap-southeast-1",
  "eu-west-2",
  "us-east-2",
];

const candidates = [
  { label: "direct", host: `db.${ref}.supabase.co`, port: 5432, user: "postgres" },
  ...poolerRegions.map((r) => ({
    label: `pooler:${r}`,
    host: `aws-0-${r}.pooler.supabase.com`,
    port: 5432,
    user: `postgres.${ref}`,
  })),
];

async function connect() {
  for (const c of candidates) {
    const client = new pg.Client({
      host: c.host,
      port: c.port,
      user: c.user,
      password,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
    try {
      await client.connect();
      console.log(`Connected via ${c.label} (${c.host})`);
      return client;
    } catch (err) {
      console.log(`  ${c.label} failed: ${err.code || err.message}`);
      try { await client.end(); } catch {}
    }
  }
  throw new Error("Could not connect to Supabase Postgres by any route.");
}

const client = await connect();
try {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const sql = readFileSync(join(migrationsDir, f), "utf8");
    process.stdout.write(`Applying ${f} ... `);
    await client.query(sql);
    console.log("ok");
  }
  console.log("All migrations applied.");
} finally {
  await client.end();
}
