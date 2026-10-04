"use client";
import Link from "next/link";
import { useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  Package,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import { useRoomie } from "@/context/RoomieContext";
import { api } from "@/lib/api";
import { formatRange, fromDateInput, toDateInput } from "@/lib/dates";
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
  function changed() {
    resources.reload();
    reservations.reload();
  }
  const visible = (reservations.data ?? []).filter(
    (r) =>
      (resourceFilter === "all" || r.resource_id === resourceFilter) &&
      (!onlyMine || r.user_id === session.user.id),
  );
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
                reservations.reload();
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
                <div className="form filters">
                  <label>
                    Recurso
                    <select
                      value={resourceFilter}
                      onChange={(e) => setResourceFilter(e.target.value)}
                    >
                      <option value="all">Todos</option>
                      {resources.data?.map((r) => (
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
                  <small role="status">
                    Mostrando {visible.length} de {reservations.data.length}{" "}
                    reservas
                  </small>
                </div>
                {visible.length ? (
                  visible.map((r) => (
                    <ReservationRow
                      key={r.id}
                      reservation={r}
                      onChanged={reservations.reload}
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
