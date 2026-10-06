"use client";
import { useLanguage } from "@/context/LanguageContext";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useReservations } from "@/hooks/useReservations";
import { PageTitle } from "@/components/ui";
import { WeekCalendar } from "@/components/reservations/WeekCalendar";
import ReservationForm from "@/components/reservations/ReservationForm";
import UpcomingReservations from "@/components/reservations/UpcomingReservations";
import ResourceList from "@/components/reservations/ResourceList";
import ResourceForm from "@/components/reservations/ResourceForm";

export default function ReservationBoard({ homeId }: { homeId: string }) {
  const { t } = useLanguage();
  const {
    admin,
    resources,
    upcoming,
    week,
    filters,
    reserve,
    cancel,
    addResource,
    updateResource,
    retireResource,
  } = useReservations(homeId);
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageTitle
        title={t("Reservas")}
        description={t("Un momento para cada persona, sin cruces.")}
        action={
          !!resources.data?.length && (
            <button
              className={creating ? "secondary" : undefined}
              onClick={() => setCreating(!creating)}
            >
              {creating ? <X size={17} /> : <Plus size={17} />}
              {creating ? t("Cancelar") : t("Nueva reserva")}
            </button>
          )
        }
      />
      <div className="dashboard-main">
        {creating && resources.data && (
          <ReservationForm
            resources={resources.data}
            reserve={reserve}
            onCreated={() => setCreating(false)}
          />
        )}
        {!!resources.data?.length && (
          <>
            <div className="form filters">
              <label>
                {t("Recurso")}
                <select
                  value={filters.resource}
                  onChange={(e) => filters.setResource(e.target.value)}
                >
                  <option value="all">{t("Todos")}</option>
                  {resources.data.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={filters.onlyMine}
                  onChange={(e) => filters.setOnlyMine(e.target.checked)}
                />
                {t("Solo mis reservas")}
              </label>
            </div>
            <WeekCalendar
              weekStart={week.start}
              onChange={week.goTo}
              reservations={week.reservations}
              error={week.error}
              retry={week.reload}
            />
          </>
        )}
        <div className="settings-grid">
          <UpcomingReservations upcoming={upcoming} cancel={cancel} />
          <ResourceList
            resources={resources}
            admin={admin}
            updateResource={updateResource}
            retireResource={retireResource}
          />
          {admin && <ResourceForm addResource={addResource} />}
        </div>
      </div>
    </>
  );
}
