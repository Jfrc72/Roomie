"use client";
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
import { useReservations } from "@/hooks/useReservations";
import { addDays, formatRange, formatTime, toDateInput } from "@/lib/dates";
import NoHome from "./NoHome";
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
      <NoHome
        title="Reservas"
        description="Un momento para cada persona, sin cruces."
      >
        Crea tu apartamento o acepta una invitación para reservar los espacios
        que comparten.
      </NoHome>
    );
  return <ReservationBoard homeId={session.activeHomeId} />;
}
function ReservationBoard({ homeId }: { homeId: string }) {
  const {
    admin,
    resources,
    upcoming,
    week,
    filters,
    reserve,
    cancel,
    addResource,
    updateResource,
    retireResource,
  } = useReservations(homeId);
  const [creating, setCreating] = useState(false);
  const [newResource, setNewResource] = useState(0);
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
                await reserve(form);
                setCreating(false);
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
                  value={filters.resource}
                  onChange={(e) => filters.setResource(e.target.value)}
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
                  checked={filters.onlyMine}
                  onChange={(e) => filters.setOnlyMine(e.target.checked)}
                />
                Solo mis reservas
              </label>
            </div>
            <WeekCalendar
              weekStart={week.start}
              onChange={week.goTo}
              reservations={week.reservations}
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
            {!upcoming.data ? (
              <LoadingError error={upcoming.error} retry={upcoming.reload} />
            ) : !upcoming.data.length ? (
              <Empty title="Todo libre por ahora">
                Cuando alguien reserve un espacio, aparecerá aquí.
              </Empty>
            ) : (
              <>
                <p role="status">
                  Mostrando {upcoming.visible.length} de {upcoming.data.length}{" "}
                  reservas próximas
                </p>
                {upcoming.visible.length ? (
                  upcoming.visible.map((r) => (
                    <ReservationRow
                      key={r.id}
                      reservation={r}
                      onCancel={() => cancel(r.id)}
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
                  onUpdate={(form) => updateResource(r.id, form)}
                  onRetire={() => retireResource(r.id)}
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
                  await addResource(form);
                  setNewResource((v) => v + 1);
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
  onCancel,
}: {
  reservation: Reservation;
  onCancel: () => Promise<void>;
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
          onConfirm={onCancel}
        />
      )}
    </div>
  );
}
function ResourceRow({
  resource,
  admin,
  onUpdate,
  onRetire,
}: {
  resource: Resource;
  admin: boolean;
  onUpdate: (form: FormData) => Promise<void>;
  onRetire: () => Promise<void>;
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
              onConfirm={onRetire}
            />
          </div>
        )}
      </div>
      {editing && (
        <Form
          success="Recurso actualizado."
          onSave={async (form) => {
            await onUpdate(form);
            setEditing(false);
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
          <button className="secondary" onClick={() => onChange(new Date())}>
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
