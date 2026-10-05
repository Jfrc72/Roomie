// Pruebas unitarias de la lógica de tareas (sin servidor ni base de datos).
import test from "node:test";
import assert from "node:assert/strict";
import { canAdvance, isOverdue, statusMoves } from "../../src/lib/tasks";

const hour = 3600000;
const ago = new Date(Date.now() - hour).toISOString();
const later = new Date(Date.now() + hour).toISOString();

test("HU3.3.3 Una tarea está vencida solo si pasó su fecha y no está completada", () => {
  assert.equal(isOverdue({ due_at: ago, status: "pending" }), true);
  assert.equal(isOverdue({ due_at: ago, status: "in_progress" }), true);
  assert.equal(isOverdue({ due_at: ago, status: "completed" }), false);
  assert.equal(isOverdue({ due_at: later, status: "pending" }), false);
  assert.equal(isOverdue({ due_at: null, status: "pending" }), false);
});

test("HU3.4.3 Sin responsable se puede avanzar el estado, pero nunca retroceder", () => {
  const open = { assigned_membership_id: null };
  assert.equal(canAdvance({ ...open, status: "pending" }, "in_progress"), true);
  assert.equal(canAdvance({ ...open, status: "pending" }, "completed"), true);
  assert.equal(
    canAdvance({ ...open, status: "in_progress" }, "completed"),
    true,
  );
  assert.equal(
    canAdvance({ ...open, status: "in_progress" }, "pending"),
    false,
  );
  assert.equal(canAdvance({ ...open, status: "completed" }, "pending"), false);
  assert.equal(
    canAdvance({ assigned_membership_id: "x", status: "pending" }, "completed"),
    false,
  );
});

test("HU3.4.4 Cada estado ofrece botones hacia los otros estados, sin arrastrar", () => {
  for (const [from, moves] of Object.entries(statusMoves)) {
    assert(moves.length > 0);
    assert(moves.every((m) => m.status !== from && m.label.length > 0));
  }
  assert.deepEqual(
    statusMoves.completed.map((m) => m.status),
    ["pending"],
  );
});
