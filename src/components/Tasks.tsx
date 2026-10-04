"use client";
import Link from "next/link";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useRoomie } from "@/context/RoomieContext";
import { api } from "@/lib/api";
import { useData } from "@/lib/use-data";
import {
  canAdvance,
  formatDate,
  isOverdue,
  priorities,
  priorityLabels,
  statuses,
  statusLabels,
  taskPayload,
  toDateInput,
} from "@/lib/tasks";
import { Empty, Form, LoadingError, PageTitle } from "./ui";
import type { Home, Member, Task, TaskStatus } from "@/types";
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
// El estado se cambia con botones: el tablero no depende de arrastrar.
const moves: Record<TaskStatus, { status: TaskStatus; label: string }[]> = {
  pending: [
    { status: "in_progress", label: "Empezar" },
    { status: "completed", label: "Completar" },
  ],
  in_progress: [
    { status: "pending", label: "Volver a pendiente" },
    { status: "completed", label: "Completar" },
  ],
  completed: [{ status: "pending", label: "Reabrir" }],
};
export function StatusButtons({
  task,
  onMoved,
}: {
  task: Task;
  onMoved: () => void;
}) {
  const { toast } = useRoomie();
  const [busy, setBusy] = useState(false);
  const options = moves[task.status].filter(
    (m) => task.can_edit || canAdvance(task, m.status),
  );
  if (!options.length) return null;
  async function move(status: TaskStatus) {
    setBusy(true);
    try {
      await api(`/tasks/${task.id}`, "PATCH", { status });
      toast(`Tarea marcada como ${statusLabels[status].toLowerCase()}.`);
      onMoved();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="actions">
      {options.map((m) => (
        <button
          key={m.status}
          className="text-button"
          disabled={busy}
          aria-label={`${m.label}: ${task.title}`}
          onClick={() => move(m.status)}
        >
          {m.label}
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
  return (
    <>
      <label>
        Título
        <input
          name="title"
          defaultValue={task?.title}
          placeholder="Ej. Sacar la basura"
          required
          minLength={2}
          maxLength={120}
        />
      </label>
      <label>
        Descripción
        <textarea
          name="description"
          defaultValue={task?.description}
          placeholder="Lo necesario para hacerla bien"
          maxLength={500}
          rows={3}
        />
      </label>
      <label>
        Responsable
        <select
          name="assigned_membership_id"
          defaultValue={task?.assigned_membership_id ?? ""}
        >
          <option value="">Sin asignar</option>
          {task?.assigned_membership_id && !task.assignee_active && (
            <option value={task.assigned_membership_id}>
              {task.assignee} (ya no pertenece)
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
        Prioridad
        <select name="priority" defaultValue={task?.priority ?? "medium"}>
          {priorities.map((p) => (
            <option key={p} value={p}>
              {priorityLabels[p]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Fecha límite
        <input
          name="due_at"
          type="datetime-local"
          defaultValue={toDateInput(task?.due_at)}
          min={task ? undefined : toDateInput(new Date().toISOString())}
        />
      </label>
      <small>
        Opcional. Quien sea responsable recibirá un recordatorio según sus
        preferencias de notificación.
      </small>
    </>
  );
}
export default function Tasks() {
  const { session } = useRoomie();
  if (!session.activeHomeId)
    return (
      <>
        <PageTitle
          title="Tareas"
          description="Una rutina más justa para todos."
        />
        <section className="panel">
          <Empty title="Primero, un hogar">
            Crea tu apartamento o acepta una invitación para repartir las tareas
            con tus roommates.
          </Empty>
          <Link className="button" href="/apartamento">
            Crear mi apartamento
          </Link>
        </section>
      </>
    );
  return <TaskBoard homeId={session.activeHomeId} />;
}
function TaskBoard({ homeId }: { homeId: string }) {
  const { session } = useRoomie();
  const tasks = useData<Task[]>(`/tasks?homeId=${homeId}`);
  const home = useData<Home & { members: Member[] }>(`/homes/${homeId}`);
  const [creating, setCreating] = useState(false);
  const [assignee, setAssignee] = useState("all");
  const [priority, setPriority] = useState("all");
  const visible = (tasks.data ?? []).filter(
    (t) =>
      (assignee === "all" ||
        (assignee === "mine" && t.assignee_user_id === session.user.id) ||
        (assignee === "none" && !t.assigned_membership_id) ||
        t.assigned_membership_id === assignee) &&
      (priority === "all" || t.priority === priority),
  );
  return (
    <>
      <PageTitle
        title="Tareas"
        description="Una rutina más justa para todos."
        action={
          <button
            className={creating ? "secondary" : undefined}
            onClick={() => setCreating(!creating)}
          >
            {creating ? <X size={17} /> : <Plus size={17} />}
            {creating ? "Cancelar" : "Nueva tarea"}
          </button>
        }
      />
      <div className="dashboard-main">
        {creating && (
          <section className="panel narrow">
            <h2>Una nueva responsabilidad</h2>
            {!home.data ? (
              <LoadingError error={home.error} retry={home.reload} />
            ) : (
              <Form
                label="Crear tarea"
                success="Tarea creada."
                onSave={async (form) => {
                  await api(
                    `/tasks?homeId=${homeId}`,
                    "POST",
                    taskPayload(form),
                  );
                  setCreating(false);
                  tasks.reload();
                }}
              >
                <TaskFields members={home.data.members} />
              </Form>
            )}
          </section>
        )}
        {!tasks.data ? (
          <LoadingError error={tasks.error} retry={tasks.reload} />
        ) : !tasks.data.length ? (
          <section className="panel">
            <Empty title="Una rutina más justa empieza aquí">
              Crea la primera tarea y asígnala a un roommate. Todos verán quién
              se encarga de qué.
            </Empty>
          </section>
        ) : (
          <>
            <div className="form task-filters">
              <label>
                Responsable
                <select
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                >
                  <option value="all">Todas</option>
                  <option value="mine">Asignadas a mí</option>
                  <option value="none">Sin asignar</option>
                  {home.data?.members.map((m) => (
                    <option key={m.membership_id} value={m.membership_id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Prioridad
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="all">Todas</option>
                  {priorities.map((p) => (
                    <option key={p} value={p}>
                      {priorityLabels[p]}
                    </option>
                  ))}
                </select>
              </label>
              <small role="status">
                Mostrando {visible.length} de {tasks.data.length} tareas
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
                      <h2 id={`tareas-${s}`}>{columns[s].title}</h2>
                      <span className="badge">{items.length}</span>
                    </div>
                    {s === "completed" && <p>Últimos 30 días</p>}
                    {items.length ? (
                      items.map((t) => (
                        <TaskCard key={t.id} task={t} onMoved={tasks.reload} />
                      ))
                    ) : (
                      <p>{columns[s].empty}</p>
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
function TaskCard({ task: t, onMoved }: { task: Task; onMoved: () => void }) {
  const overdue = isOverdue(t);
  return (
    <article className="notice">
      <h3>
        <Link href={`/tareas/${t.id}`}>{t.title}</Link>
      </h3>
      <p>
        {t.assignee
          ? `${t.assignee}${t.assignee_active ? "" : " (ya no pertenece)"}`
          : "Sin asignar"}{" "}
        · Prioridad {priorityLabels[t.priority].toLowerCase()}
        <br />
        {t.status === "completed" && t.completed_at ? (
          `Completada ${formatDate(t.completed_at)}`
        ) : overdue && t.due_at ? (
          <strong className="danger">Vencida · {formatDate(t.due_at)}</strong>
        ) : t.due_at ? (
          `Vence ${formatDate(t.due_at)}`
        ) : (
          "Sin fecha límite"
        )}
      </p>
      <StatusButtons task={t} onMoved={onMoved} />
    </article>
  );
}
