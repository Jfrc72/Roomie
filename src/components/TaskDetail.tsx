"use client";
import { useLanguage } from "@/context/LanguageContext";
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
  const { t, locale } = useLanguage();
  const { task, otherHome, error, reload, update, remove } = useTaskDetail(id);
  return (
    <>
      <PageTitle
        eyebrow={t("TAREAS")}
        title={task?.title ?? "Detalle de la tarea"}
        description={
          task
            ? t("Creada por {value1} el {value2}.", {
                value1: task.creator,
                value2: formatDate(task.created_at, locale),
              })
            : t("Quién se encarga, para cuándo y cómo ha avanzado.")
        }
        action={
          <Link className="button secondary" href="/tareas">
            <ArrowLeft size={17} />
            {t("Volver a tareas")}
          </Link>
        }
      />
      {otherHome ? (
        <section className="panel">
          <Empty title={t("Esta tarea es de otro apartamento")}>
            {t("Cámbialo en el selector de la barra superior para verla.")}
          </Empty>
        </section>
      ) : !task ? (
        <LoadingError error={t(error)} retry={reload} />
      ) : (
        <div className="settings-grid">
          <section className="panel">
            <div className="section-title">
              <h2>{task.can_edit ? t("Editar tarea") : t("Detalles")}</h2>
              <span className="badge">{t(statusLabels[task.status])}</span>
            </div>
            {task.can_edit ? (
              <>
                <TaskEditor task={task} onSave={update} />
                <div className="info-note">
                  <Trash2 size={20} />
                  <ConfirmButton
                    label={t("Eliminar tarea")}
                    description={t(
                      "¿Eliminar esta tarea? También se borrará su historial de estados.",
                    )}
                    onConfirm={remove}
                  />
                </div>
              </>
            ) : (
              <>
                <dl>
                  <dt>{t("Responsable")}</dt>
                  <dd>
                    {task.assignee
                      ? `${task.assignee}${task.assignee_active ? "" : t(" (ya no pertenece)")}`
                      : t("Sin asignar")}
                  </dd>
                  <dt>{t("Fecha límite")}</dt>
                  <dd>
                    {task.due_at
                      ? `${formatDate(task.due_at, locale)}${isOverdue(task) ? t(" · Vencida") : ""}`
                      : t("Sin fecha límite")}
                  </dd>
                  <dt>{t("Prioridad")}</dt>
                  <dd>{t(priorityLabels[task.priority])}</dd>
                  {task.completed_at && (
                    <>
                      <dt>{t("Completada")}</dt>
                      <dd>{formatDate(task.completed_at, locale)}</dd>
                    </>
                  )}
                  <dt>{t("Descripción")}</dt>
                  <dd>{task.description || t("Sin descripción")}</dd>
                </dl>
                <StatusButtons task={task} onMoved={reload} />
                <div className="info-note">
                  <ShieldCheck size={20} />
                  <p>
                    {t(
                      "Solo quien creó la tarea o un administrador pueden modificarla.",
                    )}
                    {!task.assigned_membership_id &&
                      t(
                        " Como no tiene responsable, cualquier integrante puede empezarla o completarla.",
                      )}
                  </p>
                </div>
              </>
            )}
          </section>
          <section className="panel">
            <div className="section-title">
              <h2>
                <History size={19} /> {t("Historial")}
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
                      <strong>{h.actor || t("Roomie")}</strong>{" "}
                      {h.previous_status
                        ? t("cambió el estado de {value1} a {value2}", {
                            value1: t(statusLabels[h.previous_status]),
                            value2: t(statusLabels[h.new_status]),
                          })
                        : t("creó la tarea")}
                    </p>
                    <time>{formatDate(h.created_at, locale)}</time>
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
  const { t } = useLanguage();
  const { members, error, reload } = useHomeMembers(task.home_id);
  if (!members) return <LoadingError error={t(error)} retry={reload} />;
  return (
    <Form onSave={onSave}>
      <TaskFields task={task} members={members} />
      <label>
        {t("Estado")}
        <select name="status" defaultValue={task.status}>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {t(statusLabels[s])}
            </option>
          ))}
        </select>
      </label>
    </Form>
  );
}
