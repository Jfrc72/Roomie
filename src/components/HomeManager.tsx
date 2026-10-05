"use client";
import { useLanguage } from "@/context/LanguageContext";
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
  const { t } = useLanguage();
  return (
    <>
      <label>
        {t("Nombre del apartamento")}
        <input
          name="name"
          defaultValue={home?.name}
          placeholder={t("Ej. Apartamento 302")}
          required
          minLength={2}
          maxLength={80}
        />
      </label>
      <label>
        {t("Dirección")}
        <input
          name="address"
          defaultValue={home?.address}
          placeholder={t("Calle, edificio o residencia")}
          maxLength={200}
        />
      </label>
      <label>
        {t("Sobre nuestro hogar")}
        <textarea
          name="description"
          defaultValue={home?.description}
          placeholder={t("Un pequeño resumen del lugar que comparten")}
          maxLength={500}
          rows={3}
        />
      </label>
    </>
  );
}
export default function HomeManager() {
  const { t } = useLanguage();
  const { session, refresh } = useRoomie();
  const [creating, setCreating] = useState(false);
  const home = session.homes.find((h) => h.id === session.activeHomeId);
  return (
    <>
      <PageTitle
        eyebrow={t("NUESTRO ESPACIO")}
        title={t("Mi apartamento")}
        description={t("Las personas y los acuerdos empiezan por un hogar.")}
        action={
          home && (
            <button
              className="secondary"
              onClick={() => setCreating(!creating)}
            >
              <Plus size={17} />
              {t(creating ? "Cancelar" : "Crear otro apartamento")}
            </button>
          )
        }
      />
      {(!home || creating) && (
        <section className="panel narrow">
          <h2>{t("Un espacio para compartir")}</h2>
          <p>
            {t(
              "Podrás invitar hasta 7 personas más. Tú serás el primer administrador.",
            )}
          </p>
          <Form
            label={t("Crear apartamento")}
            success={t("Tu nuevo hogar está listo.")}
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
  const { t } = useLanguage();
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
          <h2>{t("Información del hogar")}</h2>
          <span className="badge">
            {t(admin ? "Administrador" : "Integrante")}
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
            <dt>{t("Nombre")}</dt>
            <dd>{data.name}</dd>
            <dt>{t("Dirección")}</dt>
            <dd>{data.address || t("Sin dirección")}</dd>
            <dt>{t("Descripción")}</dt>
            <dd>{data.description || t("Sin descripción")}</dd>
          </dl>
        )}
        <div className="info-note">
          <ShieldCheck size={20} />
          <p>
            {t(
              "Solo los administradores pueden cambiar los datos, invitar personas y gestionar sus roles.",
            )}
          </p>
        </div>
      </section>
      <section className="panel">
        <div className="section-title">
          <h2>
            <Users size={20} /> {t("Roommates")}
          </h2>
          <span className="badge">
            {data.members.length} {t("de 8")}
          </span>
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
                  {t(m.role === "admin" ? "Administrador" : "Integrante")}
                </span>
              </div>
              {admin && (
                <div className="member-actions">
                  <ConfirmButton
                    label={t(
                      m.role === "admin"
                        ? "Cambiar a integrante"
                        : "Hacer administrador",
                    )}
                    description={t("¿Cambiar el rol de {name}?", {
                      name: m.name,
                    })}
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
                    label={t("Retirar")}
                    description={t(
                      "¿Retirar a {name}? Perderá acceso al apartamento; su historial se conservará.",
                      { name: m.name },
                    )}
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
              <Mail size={19} /> {t("Invitar a un roommate")}
            </h2>
          </div>
          <p>
            {t(
              "El enlace solo podrá aceptarlo una cuenta con este correo. Vence en 7 días.",
            )}
          </p>
          <Form
            label={t("Crear invitación")}
            success={t("Enlace de invitación creado.")}
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
              {t("Correo de la persona")}
              <input
                name="email"
                type="email"
                required
                placeholder={t("roommate@correo.com")}
              />
            </label>
          </Form>
          {inviteLink && (
            <div className="invite-result">
              <label>
                {t("Enlace para compartir")}
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
                {t("Copiar enlace")}
              </button>
              <small>
                {t(
                  "Comparte este enlace directamente. No se ha enviado un correo automáticamente.",
                )}
              </small>
            </div>
          )}
        </section>
      )}
      {admin && <Invitations key={invitesVersion} homeId={home.id} />}
      {admin && (
        <section className="panel">
          <h2>{t("Archivar apartamento")}</h2>
          <p>
            {t(
              "Dejará de estar disponible para todos sus integrantes. El historial compartido se conservará.",
            )}
          </p>
          <ConfirmButton
            label={t("Archivar apartamento")}
            description={t(
              "¿Archivar este apartamento para todos sus integrantes?",
            )}
            onConfirm={async () => {
              await api(`/homes/${home.id}`, "DELETE");
              await refresh();
            }}
          />
        </section>
      )}
    </div>
  );
}
function Invitations({ homeId }: { homeId: string }) {
  const { t } = useLanguage();
  const { data, error, reload } = useData<Invitation[]>(
    `/homes/${homeId}/invitations`,
  );
  return (
    <section className="panel">
      <h2>{t("Invitaciones del hogar")}</h2>
      {!data ? (
        <LoadingError error={error} retry={reload} />
      ) : !data.length ? (
        <p>{t("Aún no has enviado invitaciones.")}</p>
      ) : (
        data.map((i) => (
          <div className="invitation-row" key={i.id}>
            <div>
              <strong>{i.email}</strong>
              <small>
                {t(
                  i.status === "accepted"
                    ? "Aceptada"
                    : i.status === "revoked"
                      ? "Cancelada"
                      : new Date(i.expires_at) < new Date()
                        ? "Vencida"
                        : "Pendiente",
                )}
              </small>
            </div>
            {i.status === "pending" && new Date(i.expires_at) > new Date() && (
              <ConfirmButton
                label={t("Cancelar invitación")}
                description={t("El enlace dejará de funcionar.")}
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
