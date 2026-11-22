import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

// Cuenta casos aprobados por historia, no pruebas de integración ni asserts. Suma las
// unitarias de Vitest (pantallas y API anterior) y las de Jest (servicios de NestJS).
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const backend = join(root, "backend");
const jest = createRequire(join(backend, "package.json")).resolve("jest/bin/jest");
const stories = [
  ...readFileSync(join(root, "docs/HISTORIAS.md"), "utf8").matchAll(
    /^### (HU\d+\.\d+)\s+(.+)$/gm,
  ),
].map(([, id, title]) => ({ id, title, count: 0 }));
const directory = mkdtempSync(join(tmpdir(), "roomie-unitarias-"));
try {
  const resultFile = join(directory, "results.json");
  const backendFile = join(directory, "backend.json");
  const runs = [
    spawnSync(
      process.execPath,
      [
        join(root, "node_modules/vitest/vitest.mjs"),
        "run",
        "--reporter=default",
        "--reporter=json",
        `--outputFile.json=${resultFile}`,
      ],
      { cwd: root, stdio: "inherit" },
    ),
    spawnSync(
      process.execPath,
      [jest, "--runInBand", "--json", `--outputFile=${backendFile}`],
      { cwd: backend, stdio: "inherit" },
    ),
  ];
  for (const run of runs) if (run.error) throw run.error;
  if (runs.some((run) => run.status !== 0)) {
    process.exitCode = 1;
  } else {
    // Vitest y Jest escriben el mismo formato de resultados.
    const suites = [resultFile, backendFile].flatMap(
      (file) => JSON.parse(readFileSync(file, "utf8")).testResults,
    );
    const problems = [];
    let extra = 0;
    for (const suite of suites) {
      for (const test of suite.assertionResults) {
        if (test.status !== "passed") continue;
        const ids = [...new Set(test.fullName.match(/\bHU\d+\.\d+/g) ?? [])];
        if (ids.length === 0) {
          extra++;
          continue;
        }
        if (ids.length > 1) {
          problems.push(`Asigna una sola HU a la prueba: ${test.fullName}`);
          continue;
        }
        const story = stories.find(({ id }) => id === ids[0]);
        if (!story) problems.push(`Historia desconocida: ${ids[0]}`);
        else story.count++;
      }
    }
    console.log("\nPruebas unitarias aprobadas por historia:");
    for (const story of stories) {
      console.log(
        `${story.id.padEnd(7)} ${String(story.count).padStart(2)}  ${story.title}`,
      );
      if (story.count < 3)
        problems.push(
          `${story.id}: tiene ${story.count}; necesita al menos 3.`,
        );
    }
    if (stories.length === 0)
      problems.push("No se encontraron historias en docs/HISTORIAS.md.");
    console.log(
      `\n${extra} pruebas adicionales de hooks, accesibilidad y compatibilidad.`,
    );
    if (problems.length) {
      console.error(problems.join("\n"));
      process.exitCode = 1;
    } else {
      console.log(
        `Las ${stories.length} historias tienen al menos tres unitarias aprobadas.`,
      );
    }
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
