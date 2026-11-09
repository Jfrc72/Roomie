import { existsSync, copyFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { spawn } from "node:child_process";
import net from "node:net";
import { createRequire } from "node:module";
import { resolve } from "node:path";
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
function service(args, cwd) {
  const child = spawn(process.execPath, args, {
    stdio: "inherit",
    detached: process.platform !== "win32",
    cwd,
  });
  children.push(child);
  child.on("exit", (code) => {
    if (!stopping) stop(code || 1);
  });
  return child;
}
async function stop(exitCode = 0) {
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
  process.exit(exitCode);
}
async function waitForBackend() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`${process.env.API_INTERNAL_URL}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw Error("NestJS no pudo iniciar. Revisa los mensajes anteriores.");
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
process.on("SIGHUP", () => stop());
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
  const apiPort = Number(process.env.API_PORT || 3001);
  await portFree(apiPort);
  process.env.API_INTERNAL_URL ||= `http://127.0.0.1:${apiPort}`;
  if (process.env.LOCAL_DATABASE === "true") {
    const dbUrl = new URL(process.env.DATABASE_URL);
    if (!["localhost", "127.0.0.1"].includes(dbUrl.hostname))
      throw Error("LOCAL_DATABASE solo admite un host local.");
    await portFree(Number(dbUrl.port));
    const dataDirectory = process.env.LOCAL_DATABASE_DIR || ".roomie-data/postgres";
    database = new EmbeddedPostgres({
      databaseDir: dataDirectory,
      user: decodeURIComponent(dbUrl.username),
      password: decodeURIComponent(dbUrl.password),
      port: Number(dbUrl.port),
      persistent: true,
      authMethod: "scram-sha-256",
      postgresFlags: ["-h", "127.0.0.1"],
      onLog: () => {},
      onError: (message) => console.error(message),
    });
    if (!existsSync(`${dataDirectory}/PG_VERSION`))
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
  const backendRequire = createRequire(resolve("backend/package.json"));
  const nest = backendRequire.resolve("@nestjs/cli/bin/nest.js");
  await run(nest, ["build", "--path", "backend/tsconfig.build.json", "--config", "backend/nest-cli.json"]);
  service([nest, "start", "--watch"], resolve("backend"));
  await waitForBackend();
  service(["--import", "tsx", "scripts/worker.ts"]);
  service([
    "node_modules/next/dist/bin/next",
    "dev",
    "--port",
    url.port || "3000",
  ]);
  console.log("Detén la aplicación y la base de datos con Ctrl+C.");
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  await stop(1);
}
