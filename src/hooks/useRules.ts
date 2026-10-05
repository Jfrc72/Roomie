"use client";
import { useState } from "react";
import { useRoomie } from "@/context/RoomieContext";
import { api } from "@/lib/api";
import { useData } from "@/lib/use-data";
import type { Rules } from "@/types";

// Acuerdos del hogar: versión vigente, aceptaciones, historial y reportes de incumplimiento,
// con las acciones de publicar, aceptar, reportar y resolver.
export function useRules(homeId: string) {
  const { session, toast } = useRoomie();
  const admin = session.homes.find((h) => h.id === homeId)?.role === "admin";
  const { data, error, reload } = useData<Rules>(`/rules?homeId=${homeId}`);
  const [resolving, setResolving] = useState("");
  // Cada párrafo de la versión vigente es un acuerdo que se puede reportar.
  const clauses = (data?.current?.content ?? "")
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  async function publish(form: FormData) {
    await api(`/rules?homeId=${homeId}`, "POST", {
      content: form.get("content"),
      notes: form.get("notes"),
    });
    reload();
  }
  async function accept(versionId: string) {
    await api(`/rules/${versionId}/accept`, "POST", {});
    reload();
  }
  async function report(form: FormData) {
    await api(`/rules/reports?homeId=${homeId}`, "POST", {
      clause: form.get("clause"),
      description: form.get("description"),
      reported_membership_id: form.get("reported") || null,
    });
    reload();
  }
  async function resolve(reportId: string) {
    setResolving(reportId);
    try {
      await api(`/rules/reports/${reportId}/resolve`, "POST", {});
      toast("Reporte resuelto.");
      reload();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setResolving("");
    }
  }
  return {
    admin,
    rules: data,
    error,
    reload,
    clauses,
    publish,
    accept,
    report,
    resolve,
    resolving,
  };
}
