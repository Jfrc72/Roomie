"use client";
import { useState } from "react";
import { Plus, Users, Mail, Copy, ShieldCheck } from "lucide-react";
import { useRoomie } from "@/context/RoomieContext";
import { api } from "@/lib/api";
import { useData } from "@/lib/use-data";
import { Form, PageTitle, LoadingError, ConfirmButton } from "./ui";
import type { Home, Member } from "@/types";
interface Invitation {
  id: string;
  email: string;
  status: string;
  expires_at: string;
}
function HomeFields({ home }: { home?: Home }) {
  return (
    <>
      <label>
        Nombre del apartamento
        <input
          name="name"
          defaultValue={home?.name}
          placeholder="Ej. Apartamento 302"
          required
          minLength={2}
          maxLength={80}
        />
      </label>
      <label>
        Dirección
        <input
          name="address"
          defaultValue={home?.address}
          placeholder="Calle, edificio o residencia"
          maxLength={200}
        />
      </label>
      <label>
        Sobre nuestro hogar
        <textarea
          name="description"
          defaultValue={home?.description}
          placeholder="Un pequeño resumen del lugar que comparten"
          maxLength={500}
          rows={3}
        />
      </label>
    </>
  );
}
export default function HomeManager() {
  const { session, refresh } = useRoomie();
  const [creating, setCreating] = useState(false);
  const home = session.homes.find((h) => h.id === session.activeHomeId);
  return (
    <>
      <PageTitle
        eyebrow="NUESTRO ESPACIO"
        title="Mi apartamento"
        description="Las personas y los acuerdos empiezan por un hogar."
        action={
          home && (
            <button
              className="secondary"
              onClick={() => setCreating(!creating)}
            >
              <Plus size={17} />
              {creating ? "Cancelar" : "Crear otro apartamento"}
            </button>
          )
        }
      />
      {(!home || creating) && (
        <section className="panel narrow">
          <h2>Un espacio para compartir</h2>
          <p>
            Podrás invitar hasta 7 personas más. Tú serás el primer
            administrador.
          </p>
          <Form
            label="Crear apartamento"
            success="Tu nuevo hogar está listo."
            onSave={async (data) => {
              await api("/homes", "POST", Object.fromEntries(data));
              await refresh();
              setCreating(false);
            }}
          >
            <HomeFields />
          </Form>
        </section>
      )}
      {home && !creating && <HomeDetails home={home} />}
    </>
  );
}
function HomeDetails({ home }: { home: Home }) {
  const { refresh, toast } = useRoomie();
  const { data, error, reload } = useData<Home & { members: Member[] }>(
    `/homes/${home.id}`,
  );
  const [inviteLink, setInviteLink] = useState("");
  const [invitesVersion, setInvitesVersion] = useState(0);
  if (!data) return <LoadingError error={error} retry={reload} />;
  const admin = home.role === "admin";
  async function changed() {
    reload();
    await refresh();
  }
  return (
    <div className="settings-grid">
      <section className="panel">
        <div className="section-title">
          <h2>Información del hogar</h2>
          <span className="badge">
            {admin ? "Administrador" : "Integrante"}
          </span>
        </div>
        {admin ? (
          <Form
            onSave={async (form) => {
              await api(`/homes/${home.id}`, "PATCH", Object.fromEntries(form));
              await changed();
            }}
          >
            <HomeFields home={data} />
          </Form>
        ) : (
          <dl>
            <dt>Nombre</dt>
            <dd>{data.name}</dd>
            <dt>Dirección</dt>
            <dd>{data.address || "Sin dirección"}</dd>
            <dt>Descripción</dt>
            <dd>{data.description || "Sin descripción"}</dd>
          </dl>
        )}
        <div className="info-note">
          <ShieldCheck size={20} />
          <p>
            Solo los administradores pueden cambiar los datos, invitar personas
            y gestionar sus roles.
          </p>
        </div>
      </section>
      <section className="panel">
        <div className="section-title">
          <h2>
            <Users size={20} /> Roommates
          </h2>
          <span className="badge">{data.members.length} de 8</span>
        </div>
        <div className="member-list">
          {data.members.map((m) => (
            <div className="member-row" key={m.membership_id}>
              <span className="avatar soft">
                {m.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="member-info">
                <strong>{m.name}</strong>
                <small>{m.email}</small>
                <span className="role-text">
                  {m.role === "admin" ? "Administrador" : "Integrante"}
                </span>
              </div>
              {admin && (
                <div className="member-actions">
                  <ConfirmButton
                    label={
                      m.role === "admin"
                        ? "Cambiar a integrante"
                        : "Hacer administrador"
                    }
                    description={`¿Cambiar el rol de ${m.name}?`}
                    onConfirm={async () => {
                      await api(
                        `/homes/${home.id}/members/${m.membership_id}`,
                        "PATCH",
                        { role: m.role === "admin" ? "member" : "admin" },
                      );
                      await changed();
                    }}
                  />
                  <ConfirmButton
                    label="Retirar"
                    description={`¿Retirar a ${m.name}? Perderá acceso al apartamento; su historial se conservará.`}
                    onConfirm={async () => {
                      await api(
                        `/homes/${home.id}/members/${m.membership_id}`,
                        "DELETE",
                      );
                      await changed();
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
      {admin && (
        <section className="panel">
          <div className="section-title">
            <h2>
              <Mail size={19} /> Invitar a un roommate
            </h2>
          </div>
          <p>
            El enlace solo podrá aceptarlo una cuenta con este correo. Vence en
            7 días.
          </p>
          <Form
            label="Crear invitación"
            success="Enlace de invitación creado."
            onSave={async (form) => {
              const result = await api<{ url: string }>(
                `/homes/${home.id}/invitations`,
                "POST",
                Object.fromEntries(form),
              );
              setInviteLink(result.url);
              setInvitesVersion((v) => v + 1);
            }}
          >
            <label>
              Correo de la persona
              <input
                name="email"
                type="email"
                required
                placeholder="roommate@correo.com"
              />
            </label>
          </Form>
          {inviteLink && (
            <div className="invite-result">
              <label>
                Enlace para compartir
                <input
                  readOnly
                  value={inviteLink}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </label>
              <button
                className="secondary"
                onClick={() =>
                  navigator.clipboard
                    .writeText(inviteLink)
                    .then(() => toast("Enlace copiado."))
                    .catch(() =>
                      toast("Selecciona el enlace y cópialo manualmente."),
                    )
                }
              >
                <Copy size={16} />
                Copiar enlace
              </button>
              <small>
                Comparte este enlace directamente. No se ha enviado un correo
                automáticamente.
              </small>
            </div>
          )}
        </section>
      )}
      {admin && <Invitations key={invitesVersion} homeId={home.id} />}
    </div>
  );
}
function Invitations({ homeId }: { homeId: string }) {
  const { data, error, reload } = useData<Invitation[]>(
    `/homes/${homeId}/invitations`,
  );
  return (
    <section className="panel">
      <h2>Invitaciones del hogar</h2>
      {!data ? (
        <LoadingError error={error} retry={reload} />
      ) : !data.length ? (
        <p>Aún no has enviado invitaciones.</p>
      ) : (
        data.map((i) => (
          <div className="invitation-row" key={i.id}>
            <div>
              <strong>{i.email}</strong>
              <small>
                {i.status === "accepted"
                  ? "Aceptada"
                  : i.status === "revoked"
                    ? "Cancelada"
                    : new Date(i.expires_at) < new Date()
                      ? "Vencida"
                      : "Pendiente"}
              </small>
            </div>
            {i.status === "pending" && new Date(i.expires_at) > new Date() && (
              <ConfirmButton
                label="Cancelar invitación"
                description="El enlace dejará de funcionar."
                onConfirm={async () => {
                  await api(`/homes/${homeId}/invitations/${i.id}`, "DELETE");
                  reload();
                }}
              />
            )}
          </div>
        ))
      )}
    </section>
  );
}
