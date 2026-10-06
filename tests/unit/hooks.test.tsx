import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useData } from "@/lib/use-data";
import { useFormAction } from "@/lib/use-form-action";
import { useRoomieNavigation } from "@/lib/use-roomie-navigation";
import { api } from "@/lib/api";
const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/lib/api", () => ({ api: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState({}, "", "/");
});
it("ignora la respuesta de un hogar que ya no está activo", async () => {
  let oldResponse: (value: unknown) => void = () => {};
  vi.mocked(api).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        oldResponse = resolve;
      }),
  );
  vi.mocked(api).mockResolvedValueOnce({ name: "Nuevo hogar" });
  const { result, rerender } = renderHook(
    ({ path }) => useData<{ name: string }>(path),
    { initialProps: { path: "/homes/old" } },
  );
  rerender({ path: "/homes/new" });
  await waitFor(() => expect(result.current.data?.name).toBe("Nuevo hogar"));
  await act(async () => oldResponse({ name: "Viejo hogar" }));
  expect(result.current.data?.name).toBe("Nuevo hogar");
});
it("permite reintentar una carga fallida", async () => {
  vi.mocked(api)
    .mockRejectedValueOnce(new Error("Sin conexión"))
    .mockResolvedValueOnce([1]);
  const { result } = renderHook(() => useData<number[]>("/lista"));
  await waitFor(() => expect(result.current.error).toBe("Sin conexión"));
  act(() => result.current.reload());
  await waitFor(() => expect(result.current.data).toEqual([1]));
  expect(result.current.error).toBe("");
});
it("evita enviar dos veces una acción mientras está pendiente", async () => {
  let finish: () => void = () => {};
  const action = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const { result } = renderHook(useFormAction);
  let pending: Promise<boolean>;
  act(() => {
    pending = result.current.run(action);
  });
  await act(async () => expect(await result.current.run(action)).toBe(false));
  expect(action).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish();
    await pending;
  });
  expect(result.current.busy).toBe(false);
});
it("descarta un destino externo después de iniciar sesión", () => {
  window.history.replaceState({}, "", "/login?next=%2F%2Fexample.com");
  const { result } = renderHook(useRoomieNavigation);
  act(() => result.current.goAfterLogin());
  expect(navigation.push).toHaveBeenCalledWith("/");
});
it("conserva una invitación al pasar del login al registro", () => {
  window.history.replaceState(
    {},
    "",
    "/login?next=%2Finvitaciones%3Ftoken%3Dabc",
  );
  const { result } = renderHook(useRoomieNavigation);
  act(() => result.current.switchAuth(true));
  expect(navigation.push).toHaveBeenCalledWith(
    "/registro?next=%2Finvitaciones%3Ftoken%3Dabc",
  );
});
