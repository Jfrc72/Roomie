import { existsSync, copyFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { spawn } from "node:child_process";
import net from "node:net";
import EmbeddedPostgres from "embedded-postgres";
import exitHook from "async-exit-hook";

// La base local registra su propio cierre. Dejamos que este script detenga
// primero la aplicación y el worker, y después PostgreSQL.
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  exitHook.unhookEvent(signal);
}

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("Creado .env para desarrollo local.");
}
loadEnvFile(".env");
const children = [];
let database;
let stopping = false;
function run(file, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], {
      stdio: "inherit",
    });
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(Error(`El comando terminó con código ${code}`)),
    );
  });
}
function service(args) {
  const child = spawn(process.execPath, args, {
    stdio: "inherit",
    detached: process.platform !== "win32",
  });
  children.push(child);
  child.on("exit", () => {
    if (!stopping) stop();
  });
  return child;
}
async function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      if (process.platform === "win32") child.kill();
      else process.kill(-child.pid, "SIGTERM");
    } catch {}
  }
  await Promise.all(
    children.map((child) =>
      child.exitCode !== null
        ? Promise.resolve()
        : new Promise((resolve) => {
            child.once("exit", resolve);
            setTimeout(resolve, 3000);
          }),
    ),
  );
  if (database) await database.stop();
  process.exit();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("SIGHUP", stop);
function portFree(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", () =>
      reject(
        Error(
          `El puerto ${port} está ocupado. Cierra el servidor anterior antes de iniciar otro.`,
        ),
      ),
    );
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
}
try {
  const url = new URL(process.env.APP_URL || "http://localhost:3000");
  await portFree(Number(url.port || 3000));
  if (process.env.LOCAL_DATABASE === "true") {
    const dbUrl = new URL(process.env.DATABASE_URL);
    if (!["localhost", "127.0.0.1"].includes(dbUrl.hostname))
      throw Error("LOCAL_DATABASE solo admite un host local.");
    await portFree(Number(dbUrl.port));
    database = new EmbeddedPostgres({
      databaseDir: ".roomie-data/postgres",
      user: decodeURIComponent(dbUrl.username),
      password: decodeURIComponent(dbUrl.password),
      port: Number(dbUrl.port),
      persistent: true,
      authMethod: "scram-sha-256",
      postgresFlags: ["-h", "127.0.0.1"],
      onLog: () => {},
      onError: () => {},
    });
    if (!existsSync(".roomie-data/postgres/PG_VERSION"))
      await database.initialise();
    await database.start();
    const client = database.getPgClient();
    await client.connect();
    const name = dbUrl.pathname.slice(1);
    if (!/^[a-z_][a-z0-9_]*$/.test(name))
      throw Error("Nombre de base de datos inválido.");
    if (
      !(
        await client.query("SELECT 1 FROM pg_database WHERE datname=$1", [name])
      ).rowCount
    )
      await database.createDatabase(name);
    await client.end();
    console.log(
      "PostgreSQL local listo. Tus datos se conservan en .roomie-data.",
    );
  }
  await run("node_modules/tsx/dist/cli.mjs", ["scripts/migrate.ts"]);
  if (process.env.SEED_DEMO === "true")
    await run("node_modules/tsx/dist/cli.mjs", ["scripts/seed.ts"]);
  service(["--import", "tsx", "scripts/worker.ts"]);
  service([
    "node_modules/next/dist/bin/next",
    "dev",
    "--port",
    url.port || "3000",
  ]);
  console.log("Detén la aplicación y la base de datos con Ctrl+C.");
} catch (e) {
  console.error(e.message);
  if (database) await database.stop();
  process.exit(1);
}
