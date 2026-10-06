"use client";
import { useData } from "@/lib/use-data";
import { api } from "@/lib/api";
import type { ExpensesData } from "@/types/shared-modules";

export function useGastos(homeId: string | null) {
  const { data, loading, error, reload } = useData<ExpensesData>(
    homeId ? `/expenses?homeId=${encodeURIComponent(homeId)}` : null,
  );

  async function create(body: unknown) {
    await api(
      `/expenses?homeId=${encodeURIComponent(homeId ?? "")}`,
      "POST",
      body,
    );
    reload();
  }
  async function update(id: string, body: unknown) {
    await api(`/expenses/${id}`, "PATCH", body);
    reload();
  }
  async function remove(id: string) {
    await api(`/expenses/${id}`, "DELETE");
    reload();
  }
  async function restore(id: string) {
    await api(`/expenses/${id}/restore`, "POST", {});
    reload();
  }
  async function pay(body: unknown) {
    await api(
      `/payments?homeId=${encodeURIComponent(homeId ?? "")}`,
      "POST",
      body,
    );
    reload();
  }

  return { data, loading, error, reload, create, update, remove, restore, pay };
}
