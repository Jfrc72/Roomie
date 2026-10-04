"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, History, ShieldCheck, Trash2 } from "lucide-react";
import { useRoomie } from "@/context/RoomieContext";
import { api } from "@/lib/api";
import { useData } from "@/lib/use-data";
import {
  formatDate,
  isOverdue,
  priorityLabels,
  statuses,
  statusLabels,
  taskPayload,
} from "@/lib/tasks";
import { ConfirmButton, Empty, Form, LoadingError, PageTitle } from "./ui";
import { StatusButtons, TaskFields } from "./Tasks";
import type { Home, Member, Task, TaskHistoryEntry } from "@/types";
export default function TaskDetail({ id }: { id: string }) {
  const { session } = useRoomie();
  const router = useRouter();
  const { data, error, reload } = useData<
    Task & { history: TaskHistoryEntry[] }
  >(`/tasks/${id}`);
  // Al cambiar de apartamento no se sigue mostrando una tarea del anterior.
  const task = data?.home_id === session.activeHomeId ? data : null;
  return (
    <>
      <PageTitle
        eyebrow="TAREAS"
        title={task?.title ?? "Detalle de la tarea"}
        description={
          task
            ? `Creada por ${task.creator} el ${formatDate(task.created_at)}.`
            : "Quién se encarga, para cuándo y cómo ha avanzado."
        }
        action={
          <Link className="button secondary" href="/tareas">
            <ArrowLeft size={17} />
            Volver a tareas
          </Link>
        }
      />
      {!data ? (
        <LoadingError error={error} retry={reload} />
      ) : !task ? (
        <section className="panel">
          <Empty title="Esta tarea es de otro apartamento">
            Cámbialo en el selector de la barra superior para verla.
          </Empty>
        </section>
      ) : (
        <div className="settings-grid">
          <section className="panel">
            <div className="section-title">
              <h2>{task.can_edit ? "Editar tarea" : "Detalles"}</h2>
              <span className="badge">{statusLabels[task.status]}</span>
            </div>
            {task.can_edit ? (
              <>
                <TaskEditor task={task} onSaved={reload} />
                <div className="info-note">
                  <Trash2 size={20} />
                  <ConfirmButton
                    label="Eliminar tarea"
                    description="¿Eliminar esta tarea? También se borrará su historial de estados."
                    onConfirm={async () => {
                      await api(`/tasks/${task.id}`, "DELETE");
                      router.push("/tareas");
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                <dl>
                  <dt>Responsable</dt>
                  <dd>
                    {task.assignee
                      ? `${task.assignee}${task.assignee_active ? "" : " (ya no pertenece)"}`
                      : "Sin asignar"}
                  </dd>
                  <dt>Fecha límite</dt>
                  <dd>
                    {task.due_at
                      ? `${formatDate(task.due_at)}${isOverdue(task) ? " · Vencida" : ""}`
                      : "Sin fecha límite"}
                  </dd>
                  <dt>Prioridad</dt>
                  <dd>{priorityLabels[task.priority]}</dd>
                  {task.completed_at && (
                    <>
                      <dt>Completada</dt>
                      <dd>{formatDate(task.completed_at)}</dd>
                    </>
                  )}
                  <dt>Descripción</dt>
                  <dd>{task.description || "Sin descripción"}</dd>
                </dl>
                <StatusButtons task={task} onMoved={reload} />
                <div className="info-note">
                  <ShieldCheck size={20} />
                  <p>
                    Solo quien creó la tarea o un administrador pueden
                    modificarla.
                    {!task.assigned_membership_id &&
                      " Como no tiene responsable, cualquier integrante puede empezarla o completarla."}
                  </p>
                </div>
              </>
            )}
          </section>
          <section className="panel">
            <div className="section-title">
              <h2>
                <History size={19} /> Historial
              </h2>
            </div>
            <ol className="activity-list">
              {task.history.map((h) => (
                <li key={h.id}>
                  <span className="activity-avatar">
                    {(h.actor || "R").slice(0, 1)}
                  </span>
                  <div>
                    <p>
                      <strong>{h.actor || "Roomie"}</strong>{" "}
                      {h.previous_status
                        ? `cambió el estado de ${statusLabels[h.previous_status]} a ${statusLabels[h.new_status]}`
                        : "creó la tarea"}
                    </p>
                    <time>{formatDate(h.created_at)}</time>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </>
  );
}
function TaskEditor({ task, onSaved }: { task: Task; onSaved: () => void }) {
  const { data, error, reload } = useData<Home & { members: Member[] }>(
    `/homes/${task.home_id}`,
  );
  if (!data) return <LoadingError error={error} retry={reload} />;
  return (
    <Form
      onSave={async (form) => {
        await api(`/tasks/${task.id}`, "PATCH", {
          ...taskPayload(form),
          status: form.get("status"),
        });
        onSaved();
      }}
    >
      <TaskFields task={task} members={data.members} />
      <label>
        Estado
        <select name="status" defaultValue={task.status}>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
      </label>
    </Form>
  );
}
