"use client";
import { useData } from "@/lib/use-data";
import { api } from "@/lib/api";
import type { MaintenanceData } from "@/types/shared-modules";

export interface MaintenanceFilters {
  status: string;
  priority: string;
  category: string;
}

export function useMantenimiento(
  homeId: string | null,
  filters: MaintenanceFilters,
) {
  const search = new URLSearchParams();
  if (homeId) search.set("homeId", homeId);
  if (filters.status) search.set("status", filters.status);
  if (filters.priority) search.set("priority", filters.priority);
  if (filters.category) search.set("category", filters.category);
  const { data, loading, error, reload } = useData<MaintenanceData>(
    homeId ? `/maintenance?${search}` : null,
  );

  async function create(body: unknown) {
    await api(
      `/maintenance?homeId=${encodeURIComponent(homeId ?? "")}`,
      "POST",
      body,
    );
    reload();
  }
  async function update(id: string, body: unknown) {
    await api(`/maintenance/${id}`, "PATCH", body);
    reload();
  }
  async function remove(id: string) {
    await api(`/maintenance/${id}`, "DELETE");
    reload();
  }
  async function restore(id: string) {
    await api(`/maintenance/${id}/restore`, "POST", {});
    reload();
  }
  return { data, loading, error, reload, create, update, remove, restore };
}
