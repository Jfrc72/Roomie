import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { useGastos } from "@/hooks/useGastos";
import { useCompras } from "@/hooks/useCompras";
import { useMantenimiento } from "@/hooks/useMantenimiento";
import { useExpensesView } from "@/hooks/useExpensesView";
import { useShoppingView } from "@/hooks/useShoppingView";
import { useMaintenanceView } from "@/hooks/useMaintenanceView";
import { useUrlState } from "@/hooks/useUrlState";

vi.mock("@/lib/api", () => ({ api: vi.fn() }));
vi.mock("@/context/RoomieContext", () => ({
  useRoomie: () => ({ session: { activeHomeId: "h1" }, toast: vi.fn() }),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState(null, "", "/gastos");
});
const filters = { status: "", priority: "", category: "" };
describe("Carga de los módulos sin base de datos", () => {
  it("no consulta la API sin hogar seleccionado", () => {
    const { result } = renderHook(() => ({
      expenses: useGastos(null),
      shopping: useCompras(null),
      maintenance: useMantenimiento(null, filters),
    }));
    expect(api).not.toHaveBeenCalled();
    expect(result.current.expenses.loading).toBe(false);
    expect(result.current.shopping.items).toEqual([]);
    expect(result.current.maintenance.data).toBeNull();
  });
  it("termina la carga fallida y permite reintentar los gastos", async () => {
    vi.mocked(api)
      .mockRejectedValueOnce(new Error("Sin conexión"))
      .mockResolvedValueOnce({ expenses: [] });
    const { result } = renderHook(() => useGastos("h1"));
    await waitFor(() => expect(result.current.error).toBe("Sin conexión"));
    expect(result.current.loading).toBe(false);
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data?.expenses).toEqual([]));
    expect(result.current.error).toBe("");
  });
  it("descarta una lista que termina de cargar después de cambiar de hogar", async () => {
    let finish!: (data: unknown) => void;
    vi.mocked(api)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValueOnce([{ id: "nuevo" }]);
    const { result, rerender } = renderHook(({ id }) => useCompras(id), {
      initialProps: { id: "h1" },
    });
    rerender({ id: "h2" });
    await waitFor(() => expect(result.current.items[0]?.id).toBe("nuevo"));
    await act(async () => finish([{ id: "viejo" }]));
    expect(result.current.items[0].id).toBe("nuevo");
  });
  it("recarga compras después de modificar un producto", async () => {
    vi.mocked(api)
      .mockResolvedValueOnce([{ id: "i1", status: "PENDIENTE" }])
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce([{ id: "i1", status: "COMPRADO" }]);
    const { result } = renderHook(() => useCompras("h1"));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(async () => result.current.update("i1", { status: "COMPRADO" }));
    await waitFor(() =>
      expect(result.current.items[0]?.status).toBe("COMPRADO"),
    );
    expect(api).toHaveBeenCalledWith("/shopping/i1", "PATCH", {
      status: "COMPRADO",
    });
  });
  it("oculta resultados anteriores mientras cambia el filtro de mantenimiento", async () => {
    vi.mocked(api)
      .mockResolvedValueOnce({ reports: [{ id: "anterior" }] })
      .mockImplementationOnce(() => new Promise(() => {}));
    const { result, rerender } = renderHook(
      ({ status }) => useMantenimiento("h1", { ...filters, status }),
      { initialProps: { status: "" } },
    );
    await waitFor(() => expect(result.current.data?.reports).toHaveLength(1));
    rerender({ status: "RESUELTO" });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(api).toHaveBeenLastCalledWith(
      "/maintenance?homeId=h1&status=RESUELTO",
    );
  });
});
describe("Estado de las pantallas y navegación", () => {
  it("combina categoría, estado e integrante de la URL al filtrar gastos", async () => {
    window.history.replaceState(
      null,
      "",
      "/gastos?categoria=Servicios&estado=PENDIENTE&integrante=u2",
    );
    vi.mocked(api).mockImplementation(async (path) =>
      path.startsWith("/homes/")
        ? { members: [] }
        : {
            expenses: [
              {
                id: "incluido",
                category: "Servicios",
                user_status: "PENDIENTE",
                paid_by: "u1",
                shares: [{ user_id: "u2" }],
              },
              {
                id: "otra-persona",
                category: "Servicios",
                user_status: "PENDIENTE",
                paid_by: "u1",
                shares: [],
              },
              {
                id: "pagado",
                category: "Servicios",
                user_status: "PAGADO",
                paid_by: "u2",
                shares: [],
              },
              {
                id: "otra-categoria",
                category: "Varios",
                user_status: "PENDIENTE",
                paid_by: "u2",
                shares: [],
              },
            ],
          },
    );
    const { result } = renderHook(useExpensesView);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.expenses.map((e) => e.id)).toEqual(["incluido"]);
  });
  it("agrupa compras pendientes sin mezclar las compradas", async () => {
    vi.mocked(api).mockImplementation(async (path) =>
      path.startsWith("/homes/")
        ? { members: [] }
        : [
            { id: "a", category: "Alimentos", status: "PENDIENTE" },
            { id: "b", category: "Limpieza", status: "PENDIENTE" },
            { id: "c", category: "Alimentos", status: "COMPRADO" },
          ],
    );
    const { result } = renderHook(useShoppingView);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.grouped.Alimentos.map((i) => i.id)).toEqual(["a"]);
    expect(result.current.bought.map((i) => i.id)).toEqual(["c"]);
  });
  it("envía los filtros compartidos en un enlace al servidor", async () => {
    window.history.replaceState(
      null,
      "",
      "/mantenimiento?estado=PENDIENTE&prioridad=ALTA&categoria=Plomer%C3%ADa",
    );
    vi.mocked(api).mockResolvedValue({ reports: [], members: [] });
    renderHook(useMaintenanceView);
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/maintenance?homeId=h1&status=PENDIENTE&priority=ALTA&category=Plomer%C3%ADa",
      ),
    );
  });
  it("actualiza un filtro conservando los demás y el ancla", () => {
    window.history.replaceState(null, "", "/gastos?estado=PENDIENTE#lista");
    const { result, rerender } = renderHook(() => useUrlState("categoria", ""));
    act(() => result.current[1]("Servicios"));
    rerender();
    expect(result.current[0]).toBe("Servicios");
    expect(window.location.search).toContain("estado=PENDIENTE");
    expect(window.location.hash).toBe("#lista");
    act(() => result.current[1](""));
    expect(window.location.search).toBe("?estado=PENDIENTE");
  });
  it("añade una entrada de historial solo si cambia la semana", () => {
    const push = vi.spyOn(window.history, "pushState");
    const { result, rerender } = renderHook(() =>
      useUrlState("semana", "actual", "push"),
    );
    act(() => result.current[1]("2026-10-12"));
    rerender();
    act(() => result.current[1]("2026-10-12"));
    expect(push).toHaveBeenCalledTimes(1);
    push.mockRestore();
  });
});
