"use client";
import { useRoomie } from "@/context/RoomieContext";
import { api } from "@/lib/api";
import { Form, PageTitle } from "./ui";
export default function Profile() {
  const { session, refresh } = useRoomie();
  return (
    <>
      <PageTitle
        title="Mi perfil"
        description="Un pequeño espacio para tus datos."
      />
      <div className="settings-grid">
        <section className="panel">
          <h2>Información personal</h2>
          <Form
            onSave={async (form) => {
              await api("/auth/profile", "PATCH", Object.fromEntries(form));
              await refresh();
            }}
          >
            <label>
              Nombre
              <input
                name="name"
                defaultValue={session.user.name}
                required
                minLength={2}
                maxLength={80}
              />
            </label>
            <label>
              Correo
              <input value={session.user.email} disabled />
            </label>
            <small>
              El correo identifica tu cuenta y las invitaciones que puedes
              aceptar.
            </small>
          </Form>
        </section>
        <section className="panel">
          <h2>Cambiar contraseña</h2>
          <Form
            label="Actualizar contraseña"
            success="Contraseña actualizada. Se cerraron las otras sesiones."
            onSave={async (form) => {
              await api("/auth/password", "PATCH", Object.fromEntries(form));
              await refresh();
            }}
          >
            <label>
              Contraseña actual
              <input
                name="current"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
            <label>
              Nueva contraseña
              <input
                name="password"
                type="password"
                minLength={10}
                maxLength={128}
                required
                autoComplete="new-password"
              />
            </label>
            <small>Usa al menos 10 caracteres.</small>
          </Form>
        </section>
      </div>
    </>
  );
}
