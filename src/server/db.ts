import { Pool, type PoolClient, type QueryResultRow } from "pg";

const globalDb = globalThis as unknown as { roomiePool?: Pool };
export const pool =
  globalDb.roomiePool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
if (process.env.NODE_ENV !== "production") globalDb.roomiePool = pool;
// Una desconexión de un cliente inactivo no debe cerrar todo el servidor.
if (pool.listenerCount("error") === 0) {
  pool.on("error", (error) => {
    console.error("PostgreSQL: se perdió una conexión inactiva.", error.message);
  });
}
export async function query<T extends QueryResultRow>(
  sql: string,
  values: unknown[] = [],
) {
  return (await pool.query<T>(sql, values)).rows;
}
export async function transaction<T>(work: (db: PoolClient) => Promise<T>) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const result = await work(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
