"use client";
import Link from "next/link";
import { ArrowLeft, History, ShieldCheck, Trash2 } from "lucide-react";
import { useHomeMembers } from "@/hooks/useHomeMembers";
import { useTaskDetail } from "@/hooks/useTasks";
import { formatDate } from "@/lib/dates";
import { isOverdue, priorityLabels, statuses, statusLabels } from "@/lib/tasks";
import { ConfirmButton, Empty, Form, LoadingError, PageTitle } from "./ui";
import { StatusButtons, TaskFields } from "./Tasks";
import type { Task } from "@/types";
export default function TaskDetail({ id }: { id: string }) {
  const { task, otherHome, error, reload, update, remove } = useTaskDetail(id);
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
      {otherHome ? (
        <section className="panel">
          <Empty title="Esta tarea es de otro apartamento">
            Cámbialo en el selector de la barra superior para verla.
          </Empty>
        </section>
      ) : !task ? (
        <LoadingError error={error} retry={reload} />
      ) : (
        <div className="settings-grid">
          <section className="panel">
            <div className="section-title">
              <h2>{task.can_edit ? "Editar tarea" : "Detalles"}</h2>
              <span className="badge">{statusLabels[task.status]}</span>
            </div>
            {task.can_edit ? (
              <>
                <TaskEditor task={task} onSave={update} />
                <div className="info-note">
                  <Trash2 size={20} />
                  <ConfirmButton
                    label="Eliminar tarea"
                    description="¿Eliminar esta tarea? También se borrará su historial de estados."
                    onConfirm={remove}
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
function TaskEditor({
  task,
  onSave,
}: {
  task: Task;
  onSave: (form: FormData) => Promise<void>;
}) {
  const { members, error, reload } = useHomeMembers(task.home_id);
  if (!members) return <LoadingError error={error} retry={reload} />;
  return (
    <Form onSave={onSave}>
      <TaskFields task={task} members={members} />
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
