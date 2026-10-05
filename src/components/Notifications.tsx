"use client";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { useState } from "react";
import { useRoomie } from "@/context/RoomieContext";
import { useData } from "@/lib/use-data";
import { api } from "@/lib/api";
import { ConfirmButton, Empty, Form, LoadingError, PageTitle } from "./ui";
import type { Notice } from "@/types";
interface Preferences {
  email_enabled: boolean;
  push_enabled: boolean;
  reminder_hours: number;
  emailAvailable: boolean;
  pushAvailable: boolean;
}
export default function Notifications() {
  const { t, locale } = useLanguage();
  const { session, toast } = useRoomie();
  const { data, error, reload } = useData<Notice[]>(
    `/notifications?homeId=${session.activeHomeId || ""}`,
  );
  const [onlyUnread, setOnlyUnread] = useState(false);
  return (
    <>
      <PageTitle
        title={t("Notificaciones")}
        description={t("Lo importante de tu hogar, sin perder el hilo.")}
      />
      <div className="settings-grid">
        <section className="panel">
          <div className="section-title">
            <h2>{t("Tu bandeja")}</h2>
            <label className="check-label">
              <input
                type="checkbox"
                checked={onlyUnread}
                onChange={(e) => setOnlyUnread(e.target.checked)}
              />
              {t("Solo sin leer")}
            </label>
          </div>
          {!session.activeHomeId ? (
            <Empty title={t("Sin apartamento")}>
              <Link href="/apartamento">{t("Crear mi apartamento")}</Link>
            </Empty>
          ) : !data ? (
            <LoadingError error={error} retry={reload} />
          ) : !data.filter((n) => !onlyUnread || !n.read_at).length ? (
            <Empty title={t("Estás al día")}>
              {t("Cuando haya novedades de tu hogar, las encontrarás aquí.")}
            </Empty>
          ) : (
            data
              .filter((n) => !onlyUnread || !n.read_at)
              .map((n) => (
                <article
                  className={`notice ${n.read_at ? "" : "unread"}`}
                  key={n.id}
                >
                  <div>
                    <h3>{t(n.title)}</h3>
                    <p>{t(n.message)}</p>
                    <time>{new Date(n.created_at).toLocaleString(locale)}</time>
                  </div>
                  <div className="actions">
                    <Link href={n.href}>{t("Ver detalle →")}</Link>
                    <button
                      className="text-button"
                      onClick={async () => {
                        try {
                          await api(`/notifications/${n.id}`, "PATCH", {
                            read: !n.read_at,
                          });
                          reload();
                          window.dispatchEvent(new Event("roomie:notices"));
                        } catch (e) {
                          toast((e as Error).message);
                        }
                      }}
                    >
                      {t(n.read_at ? "Marcar sin leer" : "Marcar leída")}
                    </button>
                    <ConfirmButton
                      label={t("Eliminar aviso")}
                      description={t("¿Quitar este aviso de tu bandeja?")}
                      onConfirm={async () => {
                        await api(`/notifications/${n.id}`, "DELETE");
                        reload();
                        window.dispatchEvent(new Event("roomie:notices"));
                      }}
                    />
                  </div>
                </article>
              ))
          )}
        </section>
        <PreferencesPanel />
      </div>
    </>
  );
}
function PreferencesPanel() {
  const { t } = useLanguage();
  const { data, error, reload } = useData<Preferences>(
    "/notifications/preferences",
  );
  const { toast } = useRoomie();
  if (!data) return <LoadingError error={error} retry={reload} />;
  async function enablePush() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window))
        throw Error("Este navegador no admite push.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted")
        throw Error("No se concedió permiso para las notificaciones.");
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });
      await api("/notifications/subscriptions", "POST", subscription.toJSON());
      toast("Dispositivo registrado. Activa Push y guarda tus preferencias.");
    } catch (e) {
      toast((e as Error).message);
    }
  }
  return (
    <section className="panel">
      <h2>{t("A tu manera")}</h2>
      <p>{t("Elige cómo enterarte de las novedades.")}</p>
      <Form
        onSave={async (form) => {
          await api("/notifications/preferences", "PATCH", {
            email_enabled: form.get("email") === "on",
            push_enabled: form.get("push") === "on",
            reminder_hours: Number(form.get("hours")),
          });
          reload();
        }}
      >
        <label className="check-label">
          <input type="checkbox" checked disabled />
          {t("Dentro de Roomie")}
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            name="email"
            defaultChecked={data.email_enabled}
            disabled={!data.emailAvailable}
          />
          {t("Correo electrónico")}
        </label>
        {!data.emailAvailable && (
          <small>{t("El envío de correos aún no está habilitado.")}</small>
        )}
        <label className="check-label">
          <input
            type="checkbox"
            name="push"
            defaultChecked={data.push_enabled}
            disabled={!data.pushAvailable}
          />
          {t("Notificaciones push")}
        </label>
        {!data.pushAvailable ? (
          <small>
            {t("Las notificaciones push aún no están habilitadas.")}
          </small>
        ) : (
          <button type="button" className="secondary" onClick={enablePush}>
            {t("Registrar este dispositivo")}
          </button>
        )}
        <label>
          {t("Recordarme antes de un vencimiento")}
          <select name="hours" defaultValue={data.reminder_hours}>
            {[0, 1, 6, 12, 24, 48, 72, 168].map((h) => (
              <option value={h} key={h}>
                {h === 0
                  ? t("Al vencer")
                  : t("{hours} horas antes", { hours: h })}
              </option>
            ))}
          </select>
        </label>
        <small>
          {t(
            "Se aplica a los próximos recordatorios de tus tareas, pagos y reservas.",
          )}
        </small>
      </Form>
    </section>
  );
}
