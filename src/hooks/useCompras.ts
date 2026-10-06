"use client";
import { useData } from "@/lib/use-data";
import { api } from "@/lib/api";
import type { ShoppingItem } from "@/types/shared-modules";

export function useCompras(homeId: string | null) {
  const { data, loading, error, reload } = useData<ShoppingItem[]>(
    homeId ? `/shopping?homeId=${encodeURIComponent(homeId)}` : null,
  );

  async function create(body: unknown) {
    await api(
      `/shopping?homeId=${encodeURIComponent(homeId ?? "")}`,
      "POST",
      body,
    );
    reload();
  }
  async function update(id: string, body: unknown) {
    await api(`/shopping/${id}`, "PATCH", body);
    reload();
  }
  async function remove(id: string) {
    await api(`/shopping/${id}`, "DELETE");
    reload();
  }
  async function restore(id: string) {
    await api(`/shopping/${id}/restore`, "POST", {});
    reload();
  }
  return {
    items: data ?? [],
    loading,
    error,
    reload,
    create,
    update,
    remove,
    restore,
  };
}
