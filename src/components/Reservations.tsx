"use client";
import Link from "next/link";
import { useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Package,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import { useRoomie } from "@/context/RoomieContext";
import { api } from "@/lib/api";
import {
  addDays,
  formatRange,
  formatTime,
  fromDateInput,
  startOfWeek,
  toDateInput,
} from "@/lib/dates";
import { useData } from "@/lib/use-data";
import { ConfirmButton, Empty, Form, LoadingError, PageTitle } from "./ui";
import type { Reservation, Resource } from "@/types";
function ResourceFields({ resource }: { resource?: Resource }) {
  return (
    <>
      <label>
        Nombre
        <input
          name="name"
          defaultValue={resource?.name}
          placeholder="Ej. Lavadora"
          required
          minLength={2}
          maxLength={80}
        />
      </label>
      <label>
        Descripción
        <input
          name="description"
          defaultValue={resource?.description}
          placeholder="Dónde está o cómo se usa"
          maxLength={300}
        />
      </label>
    </>
  );
}
export default function Reservations() {
  const { session } = useRoomie();
  if (!session.activeHomeId)
    return (
      <>
        <PageTitle
          title="Reservas"
          description="Un momento para cada persona, sin cruces."
        />
        <section className="panel">
          <Empty title="Primero, un hogar">
            Crea tu apartamento o acepta una invitación para reservar los
            espacios que comparten.
          </Empty>
          <Link className="button" href="/apartamento">
            Crear mi apartamento
          </Link>
        </section>
      </>
    );
  return <ReservationBoard homeId={session.activeHomeId} />;
}
function ReservationBoard({ homeId }: { homeId: string }) {
  const { session } = useRoomie();
  const admin = session.homes.find((h) => h.id === homeId)?.role === "admin";
  const resources = useData<Resource[]>(`/resources?homeId=${homeId}`);
  const reservations = useData<Reservation[]>(`/reservations?homeId=${homeId}`);
  const [creating, setCreating] = useState(false);
  const [resourceFilter, setResourceFilter] = useState("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const [newResource, setNewResource] = useState(0);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const week = useData<Reservation[]>(
    `/reservations?homeId=${homeId}&from=${encodeURIComponent(weekStart.toISOString())}&to=${encodeURIComponent(addDays(weekStart, 7).toISOString())}`,
  );
  function reloadReservations() {
    reservations.reload();
    week.reload();
  }
  function changed() {
    resources.reload();
    reloadReservations();
  }
  // Los filtros se aplican al calendario y a la lista.
  const matches = (r: Reservation) =>
    (resourceFilter === "all" || r.resource_id === resourceFilter) &&
    (!onlyMine || r.user_id === session.user.id);
  const visible = (reservations.data ?? []).filter(matches);
  return (
    <>
      <PageTitle
        title="Reservas"
        description="Un momento para cada persona, sin cruces."
        action={
          !!resources.data?.length && (
            <button
              className={creating ? "secondary" : undefined}
              onClick={() => setCreating(!creating)}
            >
              {creating ? <X size={17} /> : <Plus size={17} />}
              {creating ? "Cancelar" : "Nueva reserva"}
            </button>
          )
        }
      />
      <div className="dashboard-main">
        {creating && resources.data && (
          <section className="panel narrow">
            <h2>Reservar un espacio</h2>
            <Form
              label="Reservar"
              success="Reserva creada."
              onSave={async (form) => {
                await api(`/reservations?homeId=${homeId}`, "POST", {
                  resource_id: form.get("resource_id"),
                  starts_at: fromDateInput(form.get("starts_at")),
                  ends_at: fromDateInput(form.get("ends_at")),
                });
                setCreating(false);
                reloadReservations();
              }}
            >
              <label>
                Recurso
                <select name="resource_id" required>
                  {resources.data.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Inicio
                <input
                  name="starts_at"
                  type="datetime-local"
                  required
                  min={toDateInput(new Date().toISOString())}
                />
              </label>
              <label>
                Fin
                <input
                  name="ends_at"
                  type="datetime-local"
                  required
                  min={toDateInput(new Date().toISOString())}
                />
              </label>
              <small>
                No puede cruzarse con otra reserva del mismo recurso y dura como
                máximo 7 días. Recibirás un recordatorio según tus preferencias
                de notificación.
              </small>
            </Form>
          </section>
        )}
        {!!resources.data?.length && (
          <>
            <div className="form filters">
              <label>
                Recurso
                <select
                  value={resourceFilter}
                  onChange={(e) => setResourceFilter(e.target.value)}
                >
                  <option value="all">Todos</option>
                  {resources.data.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={onlyMine}
                  onChange={(e) => setOnlyMine(e.target.checked)}
                />
                Solo mis reservas
              </label>
            </div>
            <WeekCalendar
              weekStart={weekStart}
              onChange={setWeekStart}
              reservations={week.data?.filter(matches) ?? null}
              error={week.error}
              retry={week.reload}
            />
          </>
        )}
        <div className="settings-grid">
          <section className="panel">
            <div className="section-title">
              <h2>
                <CalendarDays size={20} /> Próximas reservas
              </h2>
            </div>
            {!reservations.data ? (
              <LoadingError
                error={reservations.error}
                retry={reservations.reload}
              />
            ) : !reservations.data.length ? (
              <Empty title="Todo libre por ahora">
                Cuando alguien reserve un espacio, aparecerá aquí.
              </Empty>
            ) : (
              <>
                <p role="status">
                  Mostrando {visible.length} de {reservations.data.length}{" "}
                  reservas próximas
                </p>
                {visible.length ? (
                  visible.map((r) => (
                    <ReservationRow
                      key={r.id}
                      reservation={r}
                      onChanged={reloadReservations}
                    />
                  ))
                ) : (
                  <p>Ninguna reserva coincide con los filtros.</p>
                )}
              </>
            )}
          </section>
          <section className="panel">
            <div className="section-title">
              <h2>
                <Package size={20} /> Espacios y objetos
              </h2>
              {resources.data && (
                <span className="badge">{resources.data.length}</span>
              )}
            </div>
            {!resources.data ? (
              <LoadingError error={resources.error} retry={resources.reload} />
            ) : !resources.data.length ? (
              <p>
                {admin
                  ? "Agrega lo que comparten, como la lavadora o la sala de estudio, para empezar a reservar."
                  : "Aún no hay recursos para reservar. Pide a un administrador que agregue lo que comparten."}
              </p>
            ) : (
              resources.data.map((r) => (
                <ResourceRow
                  key={r.id}
                  resource={r}
                  admin={admin}
                  onChanged={changed}
                />
              ))
            )}
            {!admin && (
              <div className="info-note">
                <ShieldCheck size={20} />
                <p>
                  Solo los administradores agregan, editan o retiran recursos.
                </p>
              </div>
            )}
          </section>
          {admin && (
            <section className="panel">
              <div className="section-title">
                <h2>
                  <CalendarPlus size={20} /> Agregar un recurso
                </h2>
              </div>
              <p>
                Un espacio u objeto que se turnan, como la lavadora, la sala o
                la bicicleta.
              </p>
              {/* La key nueva limpia el formulario después de guardar. */}
              <Form
                key={newResource}
                label="Agregar recurso"
                success="Recurso agregado."
                onSave={async (form) => {
                  await api(
                    `/resources?homeId=${homeId}`,
                    "POST",
                    Object.fromEntries(form),
                  );
                  setNewResource((v) => v + 1);
                  resources.reload();
                }}
              >
                <ResourceFields />
              </Form>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
function ReservationRow({
  reservation: r,
  onChanged,
}: {
  reservation: Reservation;
  onChanged: () => void;
}) {
  const { session } = useRoomie();
  const ongoing = new Date(r.starts_at) <= new Date();
  return (
    <div className="invitation-row">
      <div>
        <strong>{r.resource}</strong>
        <small>
          {formatRange(r.starts_at, r.ends_at)}
          {ongoing && " · En curso"}
        </small>
        <small>
          {r.user_id === session.user.id
            ? "Tu reserva"
            : `Reservado por ${r.member}${r.member_active ? "" : " (ya no pertenece)"}`}
        </small>
      </div>
      {r.can_cancel && (
        <ConfirmButton
          label="Cancelar reserva"
          description={`¿Cancelar esta reserva de ${r.resource}? El horario quedará libre.`}
          onConfirm={async () => {
            await api(`/reservations/${r.id}`, "DELETE");
            onChanged();
          }}
        />
      )}
    </div>
  );
}
function ResourceRow({
  resource,
  admin,
  onChanged,
}: {
  resource: Resource;
  admin: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <div className="invitation-row">
        <div>
          <strong>{resource.name}</strong>
          <small>{resource.description || "Sin descripción"}</small>
        </div>
        {admin && (
          <div className="member-actions">
            <button
              className="text-button"
              onClick={() => setEditing(!editing)}
            >
              {editing ? "Cerrar edición" : "Editar"}
            </button>
            <ConfirmButton
              label="Retirar"
              description={`¿Retirar ${resource.name}? Ya no se podrá reservar; las reservas pasadas se conservan.`}
              onConfirm={async () => {
                await api(`/resources/${resource.id}`, "DELETE");
                onChanged();
              }}
            />
          </div>
        )}
      </div>
      {editing && (
        <Form
          success="Recurso actualizado."
          onSave={async (form) => {
            await api(
              `/resources/${resource.id}`,
              "PATCH",
              Object.fromEntries(form),
            );
            setEditing(false);
            onChanged();
          }}
        >
          <ResourceFields resource={resource} />
        </Form>
      )}
    </>
  );
}
// Calendario semanal de solo lectura; cancelar y reservar se hacen desde la lista y el formulario.
function WeekCalendar({
  weekStart,
  onChange,
  reservations,
  error,
  retry,
}: {
  weekStart: Date;
  onChange: (week: Date) => void;
  reservations: Reservation[] | null;
  error: string;
  retry: () => void;
}) {
  const { session } = useRoomie();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date().toDateString();
  return (
    <section className="panel" aria-labelledby="calendario-reservas">
      <div className="section-title">
        <h2 id="calendario-reservas">
          <CalendarRange size={20} /> Semana del{" "}
          {weekStart.toLocaleDateString("es-CO", {
            day: "numeric",
            month: "short",
          })}{" "}
          al{" "}
          {days[6].toLocaleDateString("es-CO", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </h2>
        <div className="actions">
          <button
            className="secondary"
            aria-label="Semana anterior"
            onClick={() => onChange(addDays(weekStart, -7))}
          >
            <ChevronLeft size={17} />
          </button>
          <button
            className="secondary"
            onClick={() => onChange(startOfWeek(new Date()))}
          >
            Esta semana
          </button>
          <button
            className="secondary"
            aria-label="Semana siguiente"
            onClick={() => onChange(addDays(weekStart, 7))}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      {!reservations ? (
        <LoadingError error={error} retry={retry} />
      ) : (
        <ol className="week-calendar">
          {days.map((day) => {
            const end = addDays(day, 1);
            const items = reservations.filter(
              (r) => new Date(r.starts_at) < end && new Date(r.ends_at) > day,
            );
            const isToday = day.toDateString() === today;
            return (
              <li
                key={day.toISOString()}
                className={`week-day${isToday ? " is-today" : ""}`}
              >
                <h3>
                  {day.toLocaleDateString("es-CO", {
                    weekday: "long",
                    day: "numeric",
                  })}
                  {isToday && <span className="badge">Hoy</span>}
                </h3>
                {items.length ? (
                  <ul>
                    {items.map((r) => (
                      <li key={r.id}>
                        <strong>{slot(r, day, end)}</strong>
                        <span>{r.resource}</span>
                        <small>
                          {r.user_id === session.user.id
                            ? "Tu reserva"
                            : r.member}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Sin reservas</p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
// Horario de una reserva dentro de un día, también si empieza antes o termina después.
function slot(reservation: Reservation, day: Date, end: Date) {
  const from = new Date(reservation.starts_at);
  const to = new Date(reservation.ends_at);
  if (from <= day && to >= end) return "Todo el día";
  if (from <= day) return `Hasta ${formatTime(to)}`;
  if (to >= end) return `Desde ${formatTime(from)}`;
  return `${formatTime(from)} – ${formatTime(to)}`;
}
