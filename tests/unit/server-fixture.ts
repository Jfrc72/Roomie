import { beforeEach, vi } from "vitest";
import type { PoolClient } from "pg";

// Solo sustituimos las dependencias externas. Las validaciones y decisiones
// de cada módulo se ejecutan de verdad, sin HTTP ni PostgreSQL.
const dependencies = vi.hoisted(() => ({
  query: vi.fn(),
  dbQuery: vi.fn(),
  requireUser: vi.fn(),
  requireHome: vi.fn(),
  activity: vi.fn(),
  notify: vi.fn(),
  scheduleReminder: vi.fn(),
  cancelReminder: vi.fn(),
  deleteCookie: vi.fn(),
}));
vi.mock("@/server/db", () => ({
  query: dependencies.query,
  transaction: (work: (db: PoolClient) => Promise<unknown>) =>
    work({ query: dependencies.dbQuery } as unknown as PoolClient),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ delete: dependencies.deleteCookie }),
}));
vi.mock("@/server/security", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/security")>()),
  requireUser: dependencies.requireUser,
}));
vi.mock("@/server/home-access", () => ({
  requireHome: dependencies.requireHome,
  activity: dependencies.activity,
}));
vi.mock("@/server/notifications", () => ({
  notify: dependencies.notify,
  scheduleReminder: dependencies.scheduleReminder,
  cancelReminder: dependencies.cancelReminder,
}));

export const mocks = dependencies;
export const userId = "00000000-0000-4000-8000-000000000001";
export const otherId = "00000000-0000-4000-8000-000000000002";
export const thirdId = "00000000-0000-4000-8000-000000000003";
export const homeId = "00000000-0000-4000-8000-000000000010";
export const recordId = "00000000-0000-4000-8000-000000000020";
export const memberId = "00000000-0000-4000-8000-000000000030";
export const otherRecordId = "00000000-0000-4000-8000-000000000040";
export function request(path: string, method = "GET", body?: unknown) {
  return new Request(`http://localhost:3000/api/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
export function dbRows(...responses: Record<string, unknown>[][]) {
  for (const rows of responses)
    dependencies.dbQuery.mockResolvedValueOnce({ rows, rowCount: rows.length });
}
export function readRows(...responses: Record<string, unknown>[][]) {
  for (const rows of responses) dependencies.query.mockResolvedValueOnce(rows);
}
export function writes(fragment: string) {
  return dependencies.dbQuery.mock.calls
    .filter(([sql]) => sql.includes(fragment))
    .map(([, values]) => values);
}
beforeEach(() => {
  vi.resetAllMocks();
  dependencies.requireUser.mockResolvedValue({
    id: userId,
    name: "Juan",
    sessionHash: "session-hash",
  });
  dependencies.requireHome.mockResolvedValue("member");
  // Un SELECT no preparado debe fallar para no ocultar cambios en las lecturas.
  dependencies.dbQuery.mockImplementation(async (sql: string) => {
    if (/^\s*SELECT|RETURNING/i.test(sql))
      throw new Error(`Falta preparar la consulta: ${sql}`);
    return { rows: [], rowCount: 0 };
  });
  dependencies.query.mockImplementation(async () => {
    throw new Error("Falta preparar la lectura");
  });
});
