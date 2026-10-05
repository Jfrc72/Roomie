// Pruebas unitarias del asistente de acuerdos con IA simulada (bono IA).
import test from "node:test";
import assert from "node:assert/strict";
import { askAssistant, assistantReply } from "../../src/lib/assistant";

test("HU9.5.1 Caso del pitch: propone una rotación equitativa para las personas indicadas", () => {
  const reply = assistantReply(
    "Somos cuatro personas y últimamente nadie está cumpliendo las tareas",
    "",
  );
  assert.match(reply.text, /^Para 4 personas propongo una rotación semanal/);
  const [rotation] = reply.clauses;
  const weeks = rotation
    .split("\n")
    .filter((line) => line.startsWith("Semana"));
  assert.equal(weeks.length, 4);
  // Cada semana, cada una de las 4 personas tiene exactamente un área distinta.
  for (const week of weeks) {
    const turns = week.split(": ").slice(1).join(": ").split("; ");
    assert.equal(turns.length, 4);
    assert(!week.includes("descansa"));
  }
  // En el ciclo, la persona 1 pasa por las 4 áreas.
  const first = weeks.map((w) => w.split("; ")[0].split(": ").pop());
  assert.equal(new Set(first).size, 4);
});

test("HU9.5.2 Usa los integrantes reales o avisa cuando no sabe cuántas personas son", () => {
  const named = assistantReply("¿Cómo nos repartimos el aseo?", "", [
    "Ana",
    "Beto",
    "Caro",
  ]);
  assert.match(named.text, /^Para 3 personas/);
  assert.match(named.clauses[0], /Ana: /);
  assert.match(named.clauses[0], /Caro: /);
  const unknown = assistantReply("Nadie cumple las tareas", "");
  assert.match(unknown.text, /usé 4; dímelo y la ajusto/);
  const six = assistantReply("vivimos 6 personas y no hay turnos", "");
  assert.match(six.clauses[0], /descansa/);
});

test("HU9.5.3 Propone cláusulas por tema y revisa qué falta en el borrador", () => {
  const visits = assistantReply("Reglas para las visitas", "");
  assert.match(visits.text, /sobre visitas/);
  assert(visits.clauses.every((c) => /visita/i.test(c)));
  // Detecta temas aunque el mensaje tenga tildes.
  assert.match(
    assistantReply("Música muy alta en la noche", "").text,
    /sobre ruido/,
  );
  const review = assistantReply(
    "Revisa mi borrador",
    "La basura se saca los lunes. Silencio después de las 10.",
  );
  assert.match(
    review.text,
    /^Revisé tu borrador\. Todavía no habla de visitas/,
  );
  assert(!review.text.includes("limpieza"));
});

test("HU9.5.4 Simula el tiempo de respuesta de un modelo antes de contestar", async () => {
  const start = Date.now();
  const reply = await askAssistant("Reglas para las visitas", "");
  assert(Date.now() - start >= 850);
  assert.deepEqual(reply, assistantReply("Reglas para las visitas", ""));
});
