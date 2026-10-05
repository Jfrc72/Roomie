"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { MaintenanceData } from "@/types/shared-modules";

export interface MaintenanceFilters {
  status: string;
  priority: string;
  category: string;
}

export function useMantenimiento(homeId: string | null, filters: MaintenanceFilters) {
  const [data, setData] = useState<MaintenanceData | null>(null);
  const [dataHomeId, setDataHomeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((current) => current + 1), []);
  useEffect(() => {
    if (!homeId) {
      return;
    }
    let active = true;
    const search = new URLSearchParams({ homeId });
    if (filters.status) search.set("status", filters.status);
    if (filters.priority) search.set("priority", filters.priority);
    if (filters.category) search.set("category", filters.category);
    api<MaintenanceData>(`/maintenance?${search.toString()}`)
      .then((result) => {
        if (active) {
          setData(result);
          setDataHomeId(homeId);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "No se pudieron cargar los reportes.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [homeId, filters.status, filters.priority, filters.category, version]);

  async function create(body: unknown) {
    await api(`/maintenance?homeId=${encodeURIComponent(homeId ?? "")}`, "POST", body);
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
  return {
    data: homeId === dataHomeId ? data : null,
    loading: loading || (!!homeId && homeId !== dataHomeId),
    error,
    reload: () => {
      setLoading(true);
      reload();
    },
    create,
    update,
    remove,
    restore,
  };
}
