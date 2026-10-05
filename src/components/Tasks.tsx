"use client";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useRoomie } from "@/context/RoomieContext";
import { useTaskMoves, useTasks } from "@/hooks/useTasks";
import { formatDate, toDateInput } from "@/lib/dates";
import { isOverdue, priorities, priorityLabels, statuses } from "@/lib/tasks";
import NoHome from "./NoHome";
import { Empty, Form, LoadingError, PageTitle } from "./ui";
import type { Member, Task, TaskStatus } from "@/types";
const columns: Record<TaskStatus, { title: string; empty: string }> = {
  pending: { title: "Pendientes", empty: "Nada por empezar." },
  in_progress: {
    title: "En progreso",
    empty: "Nadie está trabajando en una tarea.",
  },
  completed: {
    title: "Completadas",
    empty: "Sin tareas completadas en los últimos 30 días.",
  },
};
export function StatusButtons({
  task,
  onMoved,
}: {
  task: Task;
  onMoved: () => void;
}) {
  const { t } = useLanguage();
  const { options, busy, move } = useTaskMoves(task, onMoved);
  if (!options.length) return null;
  return (
    <div className="actions">
      {options.map((m) => (
        <button
          key={m.status}
          className="text-button"
          disabled={busy}
          aria-label={`${t(m.label)}: ${task.title}`}
          onClick={() => move(m.status)}
        >
          {t(m.label)}
        </button>
      ))}
    </div>
  );
}
export function TaskFields({
  task,
  members,
}: {
  task?: Task;
  members: Member[];
}) {
  const { t } = useLanguage();
  return (
    <>
      <label>
        {t("Título")}
        <input
          name="title"
          defaultValue={task?.title}
          placeholder={t("Ej. Sacar la basura")}
          required
          minLength={2}
          maxLength={120}
        />
      </label>
      <label>
        {t("Descripción")}
        <textarea
          name="description"
          defaultValue={task?.description}
          placeholder={t("Lo necesario para hacerla bien")}
          maxLength={500}
          rows={3}
        />
      </label>
      <label>
        {t("Responsable")}
        <select
          name="assigned_membership_id"
          defaultValue={task?.assigned_membership_id ?? ""}
        >
          <option value="">{t("Sin asignar")}</option>
          {task?.assigned_membership_id && !task.assignee_active && (
            <option value={task.assigned_membership_id}>
              {task.assignee} {t("(ya no pertenece)")}
            </option>
          )}
          {members.map((m) => (
            <option key={m.membership_id} value={m.membership_id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("Prioridad")}
        <select name="priority" defaultValue={task?.priority ?? "medium"}>
          {priorities.map((p) => (
            <option key={p} value={p}>
              {t(priorityLabels[p])}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("Fecha límite")}
        <input
          name="due_at"
          type="datetime-local"
          defaultValue={toDateInput(task?.due_at)}
          min={task ? undefined : toDateInput(new Date().toISOString())}
        />
      </label>
      <small>
        {t(
          "Opcional. Quien sea responsable recibirá un recordatorio según sus preferencias de notificación.",
        )}
      </small>
    </>
  );
}
export default function Tasks() {
  const { t } = useLanguage();
  const { session } = useRoomie();
  if (!session.activeHomeId)
    return (
      <NoHome
        title={t("Tareas")}
        description={t("Una rutina más justa para todos.")}
      >
        {t(
          "Crea tu apartamento o acepta una invitación para repartir las tareas con tus roommates.",
        )}
      </NoHome>
    );
  return <TaskBoard homeId={session.activeHomeId} />;
}
function TaskBoard({ homeId }: { homeId: string }) {
  const { t } = useLanguage();
  const { tasks, error, reload, members, visible, filters, createTask } =
    useTasks(homeId);
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageTitle
        title={t("Tareas")}
        description={t("Una rutina más justa para todos.")}
        action={
          <button
            className={creating ? "secondary" : undefined}
            onClick={() => setCreating(!creating)}
          >
            {creating ? <X size={17} /> : <Plus size={17} />}
            {creating ? t("Cancelar") : t("Nueva tarea")}
          </button>
        }
      />
      <div className="dashboard-main">
        {creating && (
          <section className="panel narrow">
            <h2>{t("Una nueva responsabilidad")}</h2>
            {!members.members ? (
              <LoadingError error={members.error} retry={members.reload} />
            ) : (
              <Form
                label={t("Crear tarea")}
                success={t("Tarea creada.")}
                onSave={async (form) => {
                  await createTask(form);
                  setCreating(false);
                }}
              >
                <TaskFields members={members.members} />
              </Form>
            )}
          </section>
        )}
        {!tasks ? (
          <LoadingError error={t(error)} retry={reload} />
        ) : !tasks.length ? (
          <section className="panel">
            <Empty title={t("Una rutina más justa empieza aquí")}>
              {t(
                "Crea la primera tarea y asígnala a un roommate. Todos verán quién se encarga de qué.",
              )}
            </Empty>
          </section>
        ) : (
          <>
            <div className="form filters">
              <label>
                {t("Responsable")}
                <select
                  value={filters.assignee}
                  onChange={(e) => filters.setAssignee(e.target.value)}
                >
                  <option value="all">{t("Todas")}</option>
                  <option value="mine">{t("Asignadas a mí")}</option>
                  <option value="none">{t("Sin asignar")}</option>
                  {members.members?.map((m) => (
                    <option key={m.membership_id} value={m.membership_id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("Prioridad")}
                <select
                  value={filters.priority}
                  onChange={(e) => filters.setPriority(e.target.value)}
                >
                  <option value="all">{t("Todas")}</option>
                  {priorities.map((p) => (
                    <option key={p} value={p}>
                      {t(priorityLabels[p])}
                    </option>
                  ))}
                </select>
              </label>
              <small role="status">
                {t("Mostrando")} {visible.length} {t("de")} {tasks.length}{" "}
                {t("tareas")}
              </small>
            </div>
            <div className="task-board">
              {statuses.map((s) => {
                const items = visible.filter((t) => t.status === s);
                return (
                  <section
                    className="panel"
                    key={s}
                    aria-labelledby={`tareas-${s}`}
                  >
                    <div className="section-title">
                      <h2 id={`tareas-${s}`}>{t(columns[s].title)}</h2>
                      <span className="badge">{items.length}</span>
                    </div>
                    {s === "completed" && <p>{t("Últimos 30 días")}</p>}
                    {items.length ? (
                      items.map((t) => (
                        <TaskCard key={t.id} task={t} onMoved={reload} />
                      ))
                    ) : (
                      <p>{t(columns[s].empty)}</p>
                    )}
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
function TaskCard({
  task: task,
  onMoved,
}: {
  task: Task;
  onMoved: () => void;
}) {
  const { t, locale } = useLanguage();
  const overdue = isOverdue(task);
  return (
    <article className="notice">
      <h3>
        <Link href={`/tareas/${task.id}`}>{task.title}</Link>
      </h3>
      <p>
        {task.assignee
          ? `${task.assignee}${task.assignee_active ? "" : t(" (ya no pertenece)")}`
          : t("Sin asignar")}{" "}
        {t("· Prioridad")} {t(priorityLabels[task.priority]).toLowerCase()}
        <br />
        {task.status === "completed" && task.completed_at ? (
          t("Completada {value1}", {
            value1: formatDate(task.completed_at, locale),
          })
        ) : overdue && task.due_at ? (
          <strong className="danger">
            {t("Vencida ·")} {formatDate(task.due_at, locale)}
          </strong>
        ) : task.due_at ? (
          t("Vence {value1}", { value1: formatDate(task.due_at, locale) })
        ) : (
          t("Sin fecha límite")
        )}
      </p>
      <StatusButtons task={task} onMoved={onMoved} />
    </article>
  );
}
