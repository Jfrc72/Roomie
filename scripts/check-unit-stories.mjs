import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// Cuenta casos aprobados por historia, no pruebas de integración ni asserts.
// Las historias se reparten entre Vitest (pantallas y módulos anteriores) y Jest (módulos de NestJS):
// cada prueba cuenta para la historia cuyo código HU#.# aparece en su nombre.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const stories = [
  ...readFileSync(join(root, "docs/HISTORIAS.md"), "utf8").matchAll(
    /^### (HU\d+\.\d+)\s+(.+)$/gm,
  ),
].map(([, id, title]) => ({ id, title, count: 0 }));
const directory = mkdtempSync(join(tmpdir(), "roomie-unitarias-"));

// Ambos ejecutores producen el mismo formato JSON (testResults[].assertionResults[]).
const runners = [
  {
    name: "Vitest",
    file: join(directory, "vitest.json"),
    command: (file) => [
      join(root, "node_modules/vitest/vitest.mjs"),
      "run",
      "--reporter=default",
      "--reporter=json",
      `--outputFile.json=${file}`,
    ],
    cwd: root,
  },
  {
    name: "Jest (NestJS)",
    file: join(directory, "jest.json"),
    command: (file) => [
      join(root, "node_modules/jest/bin/jest.js"),
      "--runInBand",
      "--json",
      `--outputFile=${file}`,
    ],
    cwd: join(root, "backend"),
  },
];

try {
  const reports = [];
  for (const runner of runners) {
    console.log(`\n== ${runner.name} ==`);
    const run = spawnSync(process.execPath, runner.command(runner.file), {
      cwd: runner.cwd,
      stdio: "inherit",
    });
    if (run.error) throw run.error;
    if (run.status !== 0) {
      process.exitCode = 1;
      break;
    }
    reports.push(JSON.parse(readFileSync(runner.file, "utf8")));
  }
  if (!process.exitCode) {
    const problems = [];
    let extra = 0;
    for (const report of reports) {
      for (const suite of report.testResults) {
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
      `\n${extra} pruebas adicionales de hooks, accesibilidad, compatibilidad y reglas de NestJS.`,
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
