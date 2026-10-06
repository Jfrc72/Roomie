"use client";
import { useLanguage } from "@/context/LanguageContext";
import { CalendarDays } from "lucide-react";
import { useReservations } from "@/hooks/useReservations";
import { Empty, LoadingError } from "@/components/ui";
import ReservationRow from "@/components/reservations/ReservationRow";

export default function UpcomingReservations({
  upcoming,
  cancel,
}: {
  upcoming: ReturnType<typeof useReservations>["upcoming"];
  cancel: (id: string) => Promise<void>;
}) {
  const { t } = useLanguage();

  return (
    <section className="panel">
      <div className="section-title">
        <h2>
          <CalendarDays size={20} /> {t("Próximas reservas")}
        </h2>
      </div>
      {!upcoming.data ? (
        <LoadingError error={upcoming.error} retry={upcoming.reload} />
      ) : !upcoming.data.length ? (
        <Empty title={t("Todo libre por ahora")}>
          {t("Cuando alguien reserve un espacio, aparecerá aquí.")}
        </Empty>
      ) : (
        <>
          <p role="status">
            {t("Mostrando")} {upcoming.visible.length} {t("de")}{" "}
            {upcoming.data.length} {t("reservas próximas")}
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
            <p>{t("Ninguna reserva coincide con los filtros.")}</p>
          )}
        </>
      )}
    </section>
  );
}
