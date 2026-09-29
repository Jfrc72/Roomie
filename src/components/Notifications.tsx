"use client";
import Link from "next/link";
import { useState } from "react";
import { useRoomie } from "@/context/RoomieContext";
import { useData } from "@/lib/use-data";
import { api } from "@/lib/api";
import { Empty, Form, LoadingError, PageTitle } from "./ui";
import type { Notice } from "@/types";
interface Preferences {
  email_enabled: boolean;
  push_enabled: boolean;
  reminder_hours: number;
  emailAvailable: boolean;
  pushAvailable: boolean;
}
export default function Notifications() {
  const { session, toast } = useRoomie();
  const { data, error, reload } = useData<Notice[]>(
    `/notifications?homeId=${session.activeHomeId || ""}`,
  );
  const [onlyUnread, setOnlyUnread] = useState(false);
  return (
    <>
      <PageTitle
        title="Notificaciones"
        description="Lo importante de tu hogar, sin perder el hilo."
      />
      <div className="settings-grid">
        <section className="panel">
          <div className="section-title">
            <h2>Tu bandeja</h2>
            <label className="check-label">
              <input
                type="checkbox"
                checked={onlyUnread}
                onChange={(e) => setOnlyUnread(e.target.checked)}
              />
              Solo sin leer
            </label>
          </div>
          {!data ? (
            <LoadingError error={error} retry={reload} />
          ) : !data.filter((n) => !onlyUnread || !n.read_at).length ? (
            <Empty title="Estás al día">
              Cuando haya novedades de tu hogar, las encontrarás aquí.
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
                    <h3>{n.title}</h3>
                    <p>{n.message}</p>
                    <time>
                      {new Date(n.created_at).toLocaleString("es-CO")}
                    </time>
                  </div>
                  <div className="actions">
                    <Link href={n.href}>Ver detalle →</Link>
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
                      {n.read_at ? "Marcar sin leer" : "Marcar leída"}
                    </button>
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
      <h2>A tu manera</h2>
      <p>Elige cómo enterarte de las novedades.</p>
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
          Dentro de Roomie
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            name="email"
            defaultChecked={data.email_enabled}
            disabled={!data.emailAvailable}
          />
          Correo electrónico
        </label>
        {!data.emailAvailable && (
          <small>El envío de correos aún no está habilitado.</small>
        )}
        <label className="check-label">
          <input
            type="checkbox"
            name="push"
            defaultChecked={data.push_enabled}
            disabled={!data.pushAvailable}
          />
          Notificaciones push
        </label>
        {!data.pushAvailable ? (
          <small>Las notificaciones push aún no están habilitadas.</small>
        ) : (
          <button type="button" className="secondary" onClick={enablePush}>
            Registrar este dispositivo
          </button>
        )}
        <label>
          Recordarme antes de un vencimiento
          <select name="hours" defaultValue={data.reminder_hours}>
            {[0, 1, 6, 12, 24, 48, 72, 168].map((h) => (
              <option value={h} key={h}>
                {h === 0 ? "Al vencer" : `${h} horas antes`}
              </option>
            ))}
          </select>
        </label>
        <small>
          Se aplica a los próximos recordatorios de tus tareas, pagos y
          reservas.
        </small>
      </Form>
    </section>
  );
}
