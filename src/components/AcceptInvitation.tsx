"use client";
import { useLanguage } from "@/context/LanguageContext";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRoomie } from "@/context/RoomieContext";
import { api } from "@/lib/api";
import { Form, PageTitle } from "./ui";
export default function AcceptInvitation({ token }: { token: string }) {
  const { t } = useLanguage();
  const { session, refresh } = useRoomie();
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  return (
    <>
      <PageTitle
        title={t("Te están esperando en casa")}
        description={t("Acepta la invitación para unirte a tu apartamento.")}
      />
      <section className="panel narrow">
        <h2>{t("Unirme al hogar")}</h2>
        <p>
          {t("Estás conectado como")} <strong>{session.user.email}</strong>
          {t(". Debe coincidir con el correo de la invitación.")}
        </p>
        {accepted ? (
          <button onClick={() => router.push("/")}>{t("Ir a mi hogar")}</button>
        ) : (
          <Form
            label={t("Aceptar invitación")}
            success={t("¡Bienvenido a tu apartamento!")}
            onSave={async () => {
              await api("/invitations", "POST", { token });
              await refresh();
              setAccepted(true);
              router.push("/");
            }}
          >
            <p>
              {t(
                "Al aceptar, aparecerás en la lista de integrantes y podrás acceder al espacio compartido.",
              )}
            </p>
          </Form>
        )}
      </section>
    </>
  );
}
