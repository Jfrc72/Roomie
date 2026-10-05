"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ShoppingItem } from "@/types/shared-modules";

export function useCompras(homeId: string | null) {
  const [items, setItems] = useState<ShoppingItem[]>([]);
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
    api<ShoppingItem[]>(`/shopping?homeId=${encodeURIComponent(homeId)}`)
      .then((result) => {
        if (active) {
          setItems(result);
          setDataHomeId(homeId);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "No se pudo cargar la lista.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [homeId, version]);

  async function create(body: unknown) {
    await api(`/shopping?homeId=${encodeURIComponent(homeId ?? "")}`, "POST", body);
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
    items: homeId === dataHomeId ? items : [],
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
