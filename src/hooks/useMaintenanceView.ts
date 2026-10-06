"use client";
import { useRoomie } from "@/context/RoomieContext";
import { useData } from "@/lib/use-data";
import {
  useMantenimiento,
  type MaintenanceFilters,
} from "@/hooks/useMantenimiento";
import type { Home, Member } from "@/types";
import { useUrlState } from "@/hooks/useUrlState";
export function useMaintenanceView() {
  const { session, toast } = useRoomie();
  const homeId = session.activeHomeId;
  const [status, setStatus] = useUrlState("estado", "");
  const [priority, setPriority] = useUrlState("prioridad", "");
  const [category, setCategory] = useUrlState("categoria", "");
  const filters = { status, priority, category };
  const { data, loading, error, reload, create, update, remove, restore } =
    useMantenimiento(homeId, filters);
  const { data: home } = useData<Home & { members: Member[] }>(
    homeId ? `/homes/${homeId}` : null,
  );
  const members = home?.members ?? [];
  const setFilter = (key: keyof MaintenanceFilters, value: string) =>
    ({ status: setStatus, priority: setPriority, category: setCategory })[key](
      value,
    );

  return {
    homeId,
    toast,
    data,
    loading,
    error,
    reload,
    create,
    update,
    remove,
    restore,
    members,
    filters,
    setFilter,
  };
}
