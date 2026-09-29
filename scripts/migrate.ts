import { readdir, readFile } from "node:fs/promises";
import { pool } from "../src/server/db";
export async function migrate() {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(872131)");
    await db.query(
      "CREATE TABLE IF NOT EXISTS migrations(name text PRIMARY KEY, applied_at timestamptz DEFAULT now())",
    );
    for (const name of (await readdir("db"))
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      if (
        (await db.query("SELECT name FROM migrations WHERE name=$1", [name]))
          .rowCount
      )
        continue;
      await db.query(await readFile(`db/${name}`, "utf8"));
      await db.query("INSERT INTO migrations(name) VALUES($1)", [name]);
      console.log(`Migración aplicada: ${name}`);
    }
    await db.query("COMMIT");
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
  }
}
migrate()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
    pool.end();
  });
