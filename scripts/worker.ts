import { setTimeout as sleep } from "node:timers/promises";
import { runNotificationJobs, closeNotificationWorker } from "../backend/dist/jobs/worker";

// Un ciclo del worker: recordatorios, entregas y cierre de votaciones vencidas.
// Todo vive en JobsService (NestJS); este script solo lo repite cada 15 segundos.
export async function tick() {
  try {
    await runNotificationJobs();
  } finally {
    if (process.env.WORKER_TEST) await closeNotificationWorker();
  }
}

let stopping = false;
const shutdown = new AbortController();
async function loop() {
  while (!stopping) {
    try { await tick(); }
    catch (error) { console.error("Worker:", (error as Error).message); }
    await sleep(15000, undefined, { signal: shutdown.signal }).catch(() => {});
  }
  await closeNotificationWorker();
}
process.on("SIGTERM", () => { stopping = true; shutdown.abort(); });
process.on("SIGINT", () => { stopping = true; shutdown.abort(); });
if (!process.env.WORKER_TEST) loop();
