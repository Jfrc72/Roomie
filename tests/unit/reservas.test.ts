// Pruebas unitarias de las fechas del calendario de reservas (hora local del equipo).
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  addDays,
  formatRange,
  fromDateInput,
  startOfWeek,
  toDateInput,
} from "../../src/lib/dates";

test("HU5.3.3 La semana del calendario empieza el lunes a las 00:00", () => {
  // Domingo 4 de octubre de 2026 a las 18:30 → lunes 28 de septiembre.
  const monday = startOfWeek(new Date(2026, 9, 4, 18, 30));
  assert.equal(monday.getDay(), 1);
  assert.deepEqual(
    [
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate(),
      monday.getHours(),
    ],
    [2026, 8, 28, 0],
  );
  // Un lunes es su propia semana.
  assert.equal(startOfWeek(monday).getTime(), monday.getTime());
  assert.equal(addDays(monday, 7).getDate(), 5);
});

test("HU5.3.4 Un rango del mismo día escribe la fecha una sola vez", () => {
  const sameDay = formatRange(
    new Date(2026, 9, 5, 10, 0).toISOString(),
    new Date(2026, 9, 5, 11, 0).toISOString(),
  );
  const twoDays = formatRange(
    new Date(2026, 9, 5, 22, 0).toISOString(),
    new Date(2026, 9, 6, 8, 0).toISOString(),
  );
  assert.equal(sameDay.match(/oct/g)?.length, 1);
  assert.equal(twoDays.match(/oct/g)?.length, 2);
});

test("HU5.3.5 Los campos de fecha convierten entre hora local e ISO sin perder minutos", () => {
  const local = "2026-10-05T14:45";
  const iso = fromDateInput(local);
  assert(iso);
  assert.equal(toDateInput(iso), local);
  assert.equal(fromDateInput(""), null);
  assert.equal(toDateInput(null), "");
});
