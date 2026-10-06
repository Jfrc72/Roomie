"use client";
import { useLanguage } from "@/context/LanguageContext";
import { AlertTriangle, CheckCircle2, Clock, Wrench } from "lucide-react";
import { Empty, LoadingError, PageTitle } from "@/components/ui";
import ReportCard from "@/components/maintenance/ReportCard";
import { categories } from "@/components/maintenance/fields";
import { priorities } from "@/components/maintenance/fields";
import { statuses } from "@/components/maintenance/fields";
import { statusLabels } from "@/components/maintenance/fields";
import { priorityLabels } from "@/components/maintenance/fields";
import MaintenanceForm from "@/components/maintenance/MaintenanceForm";
import { useMaintenanceView } from "@/hooks/useMaintenanceView";

export default function MantenimientoPage() {
  const { t } = useLanguage();
  const {
    homeId,
    toast,
    data,
    loading,
    error,
    reload,
    create,
    update,
    remove,
    restore,
    members,
    filters,
    setFilter,
  } = useMaintenanceView();

  if (!homeId)
    return (
      <Empty title={t("Sin apartamento")}>
        {t(
          "Selecciona un apartamento para gestionar sus reportes de mantenimiento.",
        )}
      </Empty>
    );
  if (loading && !data) return <LoadingError error={t(error)} retry={reload} />;
  if (error && !data) return <LoadingError error={t(error)} retry={reload} />;

  return (
    <div>
      <PageTitle
        title={t("Mantenimiento y reparaciones")}
        description={t(
          "Reporta daños, asigna responsables y sigue el progreso de las reparaciones.",
        )}
      />
      {error && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}
      <div
        className="stats-grid"
        style={{ marginBottom: 22 }}
        aria-label={t("Resumen de reportes")}
      >
        {[
          {
            label: "Pendientes",
            value: data?.counts.pending ?? 0,
            icon: AlertTriangle,
          },
          {
            label: "En progreso",
            value: data?.counts.in_progress ?? 0,
            icon: Clock,
          },
          {
            label: "Resueltos",
            value: data?.counts.resolved ?? 0,
            icon: CheckCircle2,
          },
        ].map(({ label, value, icon: Icon }) => (
          <article className="stat-card" key={label}>
            <div className="section-title">
              <span>{t(label)}</span>
              <Icon size={17} aria-hidden="true" />
            </div>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-title">
            <h2>
              <Wrench size={19} aria-hidden="true" /> {t("Reportes")}
            </h2>
            <button className="secondary" type="button" onClick={reload}>
              {t("Actualizar")}
            </button>
          </div>
          <div className="form module-filters">
            <label>
              {t("Estado")}
              <select
                value={filters.status}
                onChange={(event) => setFilter("status", event.target.value)}
              >
                <option value="">{t("Todos")}</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {t(statusLabels[status])}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("Prioridad")}
              <select
                value={filters.priority}
                onChange={(event) => setFilter("priority", event.target.value)}
              >
                <option value="">{t("Todas")}</option>
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {t(priorityLabels[priority])}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("Categoría")}
              <select
                value={filters.category}
                onChange={(event) => setFilter("category", event.target.value)}
              >
                <option value="">{t("Todas")}</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {t(category)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {data?.reports.length ? (
            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
              {data.reports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  members={members}
                  onUpdate={(body) => update(report.id, body)}
                  onDelete={() => remove(report.id)}
                  onRestore={() => restore(report.id)}
                  onStatusChange={(status) =>
                    update(report.id, { status }).then(() =>
                      toast("Estado del reporte actualizado."),
                    )
                  }
                />
              ))}
            </div>
          ) : (
            <Empty title={t("No hay reportes")}>
              {filters.status || filters.priority || filters.category
                ? t("No hay reportes que coincidan con estos filtros.")
                : t(
                    "Los problemas del apartamento que reporten aparecerán aquí.",
                  )}
            </Empty>
          )}
        </section>
        <MaintenanceForm members={members} create={create} />
      </div>
    </div>
  );
}
