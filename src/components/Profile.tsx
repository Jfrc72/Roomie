"use client";
import { useLanguage } from "@/context/LanguageContext";
import { useRoomie } from "@/context/RoomieContext";
import { api } from "@/lib/api";
import { Form, PageTitle } from "./ui";
import { useRouter } from "next/navigation";
export default function Profile() {
  const { t } = useLanguage();
  const { session, refresh } = useRoomie();
  const router = useRouter();
  return (
    <>
      <PageTitle
        title={t("Mi perfil")}
        description={t("Un pequeño espacio para tus datos.")}
      />
      <div className="settings-grid">
        <section className="panel">
          <h2>{t("Información personal")}</h2>
          <Form
            onSave={async (form) => {
              await api("/auth/profile", "PATCH", Object.fromEntries(form));
              await refresh();
            }}
          >
            <label>
              {t("Nombre")}
              <input
                name="name"
                defaultValue={session.user.name}
                required
                minLength={2}
                maxLength={80}
              />
            </label>
            <label>
              {t("Correo")}
              <input value={session.user.email} disabled />
            </label>
            <small>
              {t(
                "El correo identifica tu cuenta y las invitaciones que puedes aceptar.",
              )}
            </small>
          </Form>
        </section>
        <section className="panel">
          <h2>{t("Cerrar mi cuenta")}</h2>
          <p>
            {t(
              "Tu cuenta se desactivará. El perfil dejará de mostrar tu nombre y correo; el historial compartido se conservará.",
            )}
          </p>
          <p>
            {t(
              "Si eres el único administrador de un apartamento, asigna otro o archiva el hogar primero.",
            )}
          </p>
          <Form
            label={t("Cerrar mi cuenta")}
            success={t("Cuenta cerrada.")}
            onSave={async (form) => {
              await api("/auth/account", "DELETE", {
                current: form.get("current"),
              });
              router.push("/login");
              router.refresh();
            }}
          >
            <label>
              {t("Confirma tu contraseña")}
              <input
                name="current"
                type="password"
                required
                autoComplete="current-password"
                maxLength={128}
              />
            </label>
            <label className="check-label">
              <input type="checkbox" required />
              {t("Confirmo que quiero cerrar mi cuenta.")}
            </label>
          </Form>
        </section>
        <section className="panel">
          <h2>{t("Cambiar contraseña")}</h2>
          <Form
            label={t("Actualizar contraseña")}
            success={t(
              "Contraseña actualizada. Se cerraron las otras sesiones.",
            )}
            onSave={async (form) => {
              await api("/auth/password", "PATCH", Object.fromEntries(form));
              await refresh();
            }}
          >
            <label>
              {t("Contraseña actual")}
              <input
                name="current"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
            <label>
              {t("Nueva contraseña")}
              <input
                name="password"
                type="password"
                minLength={10}
                maxLength={128}
                required
                autoComplete="new-password"
              />
            </label>
            <small>{t("Usa al menos 10 caracteres.")}</small>
          </Form>
        </section>
      </div>
    </>
  );
}
