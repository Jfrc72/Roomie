"use client";
import { useLanguage } from "@/context/LanguageContext";
import { Package, ShieldCheck } from "lucide-react";
import { useReservations } from "@/hooks/useReservations";
import { LoadingError } from "@/components/ui";
import ResourceRow from "@/components/reservations/ResourceRow";

export default function ResourceList({
  resources,
  admin,
  updateResource,
  retireResource,
}: {
  resources: ReturnType<typeof useReservations>["resources"];
  admin: boolean;
  updateResource: (id: string, form: FormData) => Promise<void>;
  retireResource: (id: string) => Promise<void>;
}) {
  const { t } = useLanguage();

  return (
    <section className="panel">
      <div className="section-title">
        <h2>
          <Package size={20} /> {t("Espacios y objetos")}
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
            ? t(
                "Agrega lo que comparten, como la lavadora o la sala de estudio, para empezar a reservar.",
              )
            : t(
                "Aún no hay recursos para reservar. Pide a un administrador que agregue lo que comparten.",
              )}
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
            {t("Solo los administradores agregan, editan o retiran recursos.")}
          </p>
        </div>
      )}
    </section>
  );
}
