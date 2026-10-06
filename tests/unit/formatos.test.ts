import { describe, expect, it, vi, afterEach } from "vitest";
import { formatCurrency } from "@/lib/money";
import { formatDay, localToday } from "@/lib/dates";

afterEach(() => vi.useRealTimers());
describe("Formatos compartidos", () => {
  it("conserva centavos y usa separadores en español", () => {
    expect(formatCurrency(1234.56, "es-CO")).toMatch(/1\.234,56/);
  });
  it("conserva centavos y la moneda COP en inglés", () => {
    expect(formatCurrency(1234.56, "en-US")).toContain("COP");
    expect(formatCurrency(1234.56, "en-US")).toContain("1,234.56");
  });
  it("muestra saldos negativos y cero", () => {
    expect(formatCurrency(-10.5, "en-US")).toContain("-COP");
    expect(formatCurrency(0, "en-US")).toMatch(/0$/);
  });
  it("conserva el día de un gasto sin convertirlo desde UTC", () => {
    expect(formatDay("2026-01-01", "en-US")).toBe("Jan 1, 2026");
  });
  it("cambia el nombre del mes con el idioma", () => {
    expect(formatDay("2026-01-01", "es-CO")).toContain("ene");
    expect(formatDay("2026-01-01", "en-US")).toContain("Jan");
  });
  it("calcula la fecha actual de nuevo después de medianoche", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 23, 59));
    expect(localToday()).toBe("2026-01-01");
    vi.setSystemTime(new Date(2026, 0, 2, 0, 1));
    expect(localToday()).toBe("2026-01-02");
  });
});
