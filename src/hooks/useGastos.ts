"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ExpensesData } from "@/types/shared-modules";

export function useGastos(homeId: string | null) {
  const [data, setData] = useState<ExpensesData | null>(null);
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
    api<ExpensesData>(`/expenses?homeId=${encodeURIComponent(homeId)}`)
      .then((result) => {
        if (active) {
          setData(result);
          setDataHomeId(homeId);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "No se pudieron cargar los gastos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [homeId, version]);

  async function create(body: unknown) {
    await api(`/expenses?homeId=${encodeURIComponent(homeId ?? "")}`, "POST", body);
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
    await api(`/payments?homeId=${encodeURIComponent(homeId ?? "")}`, "POST", body);
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
    pay,
  };
}
