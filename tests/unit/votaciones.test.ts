// Pruebas unitarias del cálculo de resultados (el mismo que usan el aviso de cierre y la interfaz).
import { test } from "vitest";
import assert from "node:assert/strict";
import { pollResult } from "../../src/lib/polls";

const options = (...votes: number[]) =>
  votes.map((v, i) => ({ label: `Opción ${i + 1}`, votes: v }));

test("HU8.2.1 Mayoría simple: gana la opción con más votos", () => {
  const result = pollResult(options(3, 1, 0), "simple", 5);
  assert.equal(result.winner?.label, "Opción 1");
  assert.equal(result.text, 'ganó "Opción 1".');
});

test("HU8.2.2 Mayoría simple: un empate o ningún voto no tienen ganadora", () => {
  const tie = pollResult(options(2, 2, 1), "simple", 5);
  assert.equal(tie.winner, null);
  assert.equal(tie.leaders.length, 2);
  assert.equal(tie.text, "empate entre 2 opciones.");
  const empty = pollResult(options(0, 0), "simple", 3);
  assert.equal(empty.winner, null);
  assert.equal(empty.text, "nadie votó.");
});

test("HU8.2.3 Unanimidad: gana solo si todos los habilitados votan lo mismo", () => {
  const all = pollResult(options(3, 0), "unanimous", 3);
  assert.equal(all.winner?.label, "Opción 1");
  assert.equal(all.text, 'ganó "Opción 1" por unanimidad.');
  // Una abstención (2 de 3) o un voto distinto bastan para que no haya ganadora.
  assert.equal(pollResult(options(2, 0), "unanimous", 3).winner, null);
  assert.equal(
    pollResult(options(2, 1), "unanimous", 3).text,
    "no hubo unanimidad.",
  );
});
