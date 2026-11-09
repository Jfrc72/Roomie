import { setTimeout as sleep } from "node:timers/promises";
import { pool } from "../src/server/db";
import { closeExpiredPolls } from "../src/server/polls";
import { runNotificationJobs, closeNotificationWorker } from "../backend/dist/jobs/worker";

export async function tick() {
  try {
    await runNotificationJobs();
    // Votaciones sigue en Next.js hasta que Miguel migre ese módulo.
    await closeExpiredPolls();
  } finally {
    if (process.env.WORKER_TEST) await closeNotificationWorker();
  }
}

let stopping = false;
const shutdown = new AbortController();
async function loop() {
  while (!stopping) {
    try { await tick(); }
    catch (error) { console.error("Recordatorios:", (error as Error).message); }
    await sleep(15000, undefined, { signal: shutdown.signal }).catch(() => {});
  }
  await closeNotificationWorker();
  await pool.end();
}
process.on("SIGTERM", () => { stopping = true; shutdown.abort(); });
process.on("SIGINT", () => { stopping = true; shutdown.abort(); });
if (!process.env.WORKER_TEST) loop();
