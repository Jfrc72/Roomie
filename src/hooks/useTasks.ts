"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRoomie } from "@/context/RoomieContext";
import { useLanguage } from "@/context/LanguageContext";
import { api } from "@/lib/api";
import { useData } from "@/lib/use-data";
import {
  canAdvance,
  statusLabels,
  statusMoves,
  taskPayload,
} from "@/lib/tasks";
import { useHomeMembers } from "./useHomeMembers";
import { useUrlState } from "./useUrlState";
import type { Task, TaskHistoryEntry, TaskStatus } from "@/types";

// Tablero: tareas del hogar, integrantes para asignar, filtros guardados en la URL y creación.
export function useTasks(homeId: string) {
  const { session } = useRoomie();
  const { data, error, reload } = useData<Task[]>(`/tasks?homeId=${homeId}`);
  const members = useHomeMembers(homeId);
  const [assignee, setAssignee] = useUrlState("responsable", "all");
  const [priority, setPriority] = useUrlState("prioridad", "all");
  const visible = (data ?? []).filter(
    (t) =>
      (assignee === "all" ||
        (assignee === "mine" && t.assignee_user_id === session.user.id) ||
        (assignee === "none" && !t.assigned_membership_id) ||
        t.assigned_membership_id === assignee) &&
      (priority === "all" || t.priority === priority),
  );
  async function createTask(form: FormData) {
    await api(`/tasks?homeId=${homeId}`, "POST", taskPayload(form));
    reload();
  }
  return {
    tasks: data,
    error,
    reload,
    members,
    visible,
    filters: { assignee, setAssignee, priority, setPriority },
    createTask,
  };
}

// Botones de estado de una tarea: opciones que la persona puede usar, envío y estado ocupado.
export function useTaskMoves(task: Task, onMoved: () => void) {
  const { t } = useLanguage();
  const { toast } = useRoomie();
  const [busy, setBusy] = useState(false);
  const options = statusMoves[task.status].filter(
    (m) => task.can_edit || canAdvance(task, m.status),
  );
  async function move(status: TaskStatus) {
    setBusy(true);
    try {
      await api(`/tasks/${task.id}`, "PATCH", { status });
      toast(
        t("Tarea marcada como {status}.", {
          status: t(statusLabels[status]).toLowerCase(),
        }),
      );
      onMoved();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return { options, busy, move };
}

// Detalle: la tarea con su historial, edición, eliminación y vuelta al tablero.
export function useTaskDetail(id: string) {
  const { session } = useRoomie();
  const router = useRouter();
  const { data, error, reload } = useData<
    Task & { history: TaskHistoryEntry[] }
  >(`/tasks/${id}`);
  // Al cambiar de apartamento no se sigue mostrando una tarea del anterior.
  const task = data?.home_id === session.activeHomeId ? data : null;
  async function update(form: FormData) {
    await api(`/tasks/${id}`, "PATCH", {
      ...taskPayload(form),
      status: form.get("status"),
    });
    reload();
  }
  async function remove() {
    await api(`/tasks/${id}`, "DELETE");
    router.push("/tareas");
  }
  return {
    task,
    otherHome: data !== null && !task,
    error,
    reload,
    update,
    remove,
  };
}
