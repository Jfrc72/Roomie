"use client";
import { useMemo } from "react";
import { useRoomie } from "@/context/RoomieContext";
import { useCompras } from "@/hooks/useCompras";
import { useData } from "@/lib/use-data";
import type { Home, Member } from "@/types";
import type { ShoppingItem } from "@/types/shared-modules";

export function useShoppingView() {
  const { session } = useRoomie();
  const homeId = session.activeHomeId;
  const { toast } = useRoomie();
  const { items, loading, error, reload, create, update, remove, restore } =
    useCompras(homeId);
  const { data: home } = useData<Home & { members: Member[] }>(
    homeId ? `/homes/${homeId}` : null,
  );
  const members = home?.members ?? [];
  const pending = useMemo(
    () => items.filter((item) => item.status === "PENDIENTE"),
    [items],
  );
  const bought = useMemo(
    () => items.filter((item) => item.status === "COMPRADO"),
    [items],
  );
  const grouped = useMemo(
    () =>
      pending.reduce<Record<string, ShoppingItem[]>>((groups, item) => {
        (groups[item.category] ??= []).push(item);
        return groups;
      }, {}),
    [pending],
  );

  return {
    homeId,
    toast,
    items,
    loading,
    error,
    reload,
    create,
    update,
    remove,
    restore,
    members,
    pending,
    bought,
    grouped,
  };
}
