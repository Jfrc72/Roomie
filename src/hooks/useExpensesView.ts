"use client";
import { useMemo } from "react";
import { useRoomie } from "@/context/RoomieContext";
import { useData } from "@/lib/use-data";
import { useGastos } from "@/hooks/useGastos";
import type { Home, Member } from "@/types";
import { useUrlState } from "@/hooks/useUrlState";
export function useExpensesView() {
  const { session } = useRoomie();
  const homeId = session.activeHomeId;
  const { data, loading, error, reload, create, update, remove, restore, pay } =
    useGastos(homeId);
  const { data: home } = useData<Home & { members: Member[] }>(
    homeId ? `/homes/${homeId}` : null,
  );
  const [categoryFilter, setCategoryFilter] = useUrlState("categoria", "");
  const [statusFilter, setStatusFilter] = useUrlState("estado", "");
  const [personFilter, setPersonFilter] = useUrlState("integrante", "");
  const members = home?.members ?? [];
  const expenses = useMemo(
    () =>
      (data?.expenses ?? []).filter(
        (expense) =>
          (!categoryFilter || expense.category === categoryFilter) &&
          (!statusFilter || expense.user_status === statusFilter) &&
          (!personFilter ||
            expense.paid_by === personFilter ||
            expense.shares.some((share) => share.user_id === personFilter)),
      ),
    [data?.expenses, categoryFilter, statusFilter, personFilter],
  );

  return {
    session,
    homeId,
    data,
    loading,
    error,
    reload,
    create,
    update,
    remove,
    restore,
    pay,
    members,
    expenses,
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    personFilter,
    setPersonFilter,
  };
}
