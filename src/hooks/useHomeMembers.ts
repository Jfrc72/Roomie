"use client";
import { useData } from "@/lib/use-data";
import type { Home, Member } from "@/types";

// Integrantes activos de un hogar, para elegir responsables o personalizar el asistente.
export function useHomeMembers(homeId: string) {
  const { data, error, reload } = useData<Home & { members: Member[] }>(
    `/homes/${homeId}`,
  );
  return { members: data?.members ?? null, error, reload };
}
