import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// Cuenta casos aprobados por historia, no pruebas de integración ni asserts.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const stories = [
  ...readFileSync(join(root, "docs/HISTORIAS.md"), "utf8").matchAll(
    /^### (HU\d+\.\d+)\s+(.+)$/gm,
  ),
].map(([, id, title]) => ({ id, title, count: 0 }));
const directory = mkdtempSync(join(tmpdir(), "roomie-unitarias-"));
try {
  const resultFile = join(directory, "results.json");
  const run = spawnSync(
    process.execPath,
    [
      join(root, "node_modules/vitest/vitest.mjs"),
      "run",
      "--reporter=default",
      "--reporter=json",
      `--outputFile.json=${resultFile}`,
    ],
    { cwd: root, stdio: "inherit" },
  );
  if (run.error) throw run.error;
  if (run.status !== 0) {
    process.exitCode = 1;
  } else {
    const report = JSON.parse(readFileSync(resultFile, "utf8"));
    const problems = [];
    let extra = 0;
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
