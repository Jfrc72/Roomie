"use client";
import { useLanguage } from "@/context/LanguageContext";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Wrench } from "lucide-react";
import {
  ConfirmButton,
  Empty,
  Form,
  LoadingError,
  PageTitle,
} from "@/components/ui";
import { useRoomie } from "@/context/RoomieContext";
import { useData } from "@/lib/use-data";
import {
  useMantenimiento,
  type MaintenanceFilters,
} from "@/hooks/useMantenimiento";
import type { Home, Member } from "@/types";
import type {
  MaintenancePriority,
  MaintenanceReport,
  MaintenanceStatus,
} from "@/types/shared-modules";

const categories = [
  "Plomería",
  "Electricidad",
  "Carpintería",
  "Electrodomésticos",
  "Estructura",
  "Otros",
];
const priorities: MaintenancePriority[] = ["BAJA", "MEDIA", "ALTA", "URGENTE"];
const statuses: MaintenanceStatus[] = ["PENDIENTE", "EN_PROGRESO", "RESUELTO"];
const statusLabels: Record<MaintenanceStatus, string> = {
  PENDIENTE: "Pendiente",
  EN_PROGRESO: "En progreso",
  RESUELTO: "Resuelto",
};
const priorityLabels: Record<MaintenancePriority, string> = {
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

function reportBody(form: FormData) {
  return {
    title: String(form.get("title") ?? ""),
    description: String(form.get("description") ?? ""),
    category: String(form.get("category") ?? "Otros"),
    estimated_cost: form.get("estimated_cost")
      ? Number(form.get("estimated_cost"))
      : null,
    priority: String(form.get("priority") ?? "MEDIA"),
    assigned_membership_id:
      String(form.get("assigned_membership_id") ?? "") || null,
  };
}

export default function MantenimientoPage() {
  const { t } = useLanguage();
  const { session, toast } = useRoomie();
  const homeId = session.activeHomeId;
  const [filters, setFilters] = useState<MaintenanceFilters>({
    status: "",
    priority: "",
    category: "",
  });
  const { data, loading, error, reload, create, update, remove, restore } =
    useMantenimiento(homeId, filters);
  const { data: home } = useData<Home & { members: Member[] }>(
    homeId ? `/homes/${homeId}` : "/session",
  );
  const members = home?.members ?? [];
  const setFilter = (key: keyof MaintenanceFilters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));

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
          <div
            className="form"
            style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}
          >
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
        <aside className="panel narrow">
          <h2>{t("Reportar un daño")}</h2>
          <Form
            label={t("Enviar reporte")}
            success={t("Reporte de mantenimiento creado.")}
            onSave={(form) => create(reportBody(form))}
          >
            <label>
              {t("¿Qué necesita reparación?")}
              <input
                name="title"
                required
                minLength={3}
                maxLength={255}
                placeholder={t("Ej. Fuga en la cocina")}
              />
            </label>
            <label>
              {t("Categoría")}
              <select name="category" defaultValue="Otros">
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {t(category)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("Prioridad")}
              <select name="priority" defaultValue="MEDIA">
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {t(priorityLabels[priority])}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("Costo estimado (COP, opcional)")}
              <input name="estimated_cost" type="number" min="0" step="0.01" />
            </label>
            <label>
              {t("Asignar a (opcional)")}
              <select name="assigned_membership_id" defaultValue="">
                <option value="">{t("Sin asignar")}</option>
                {members.map((member) => (
                  <option
                    key={member.membership_id}
                    value={member.membership_id}
                  >
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("Detalles")}
              <textarea
                name="description"
                rows={4}
                maxLength={2000}
                placeholder={t("Describe el problema y dónde ocurre.")}
              />
            </label>
          </Form>
        </aside>
      </div>
    </div>
  );
}

function ReportCard({
  report,
  members,
  onUpdate,
  onDelete,
  onStatusChange,
  onRestore,
}: {
  report: MaintenanceReport;
  members: Member[];
  onUpdate: (body: unknown) => Promise<void>;
  onDelete: () => Promise<void>;
  onStatusChange: (status: MaintenanceStatus) => Promise<void>;
  onRestore: () => Promise<void>;
}) {
  const { t, locale } = useLanguage();
  const { toast } = useRoomie();
  const date = new Date(report.created_at).toLocaleDateString(locale);
  return (
    <article className="panel" style={{ padding: 16 }}>
      <div className="section-title">
        <h3>{report.title}</h3>
        <span
          className={`badge ${report.priority === "URGENTE" || report.priority === "ALTA" ? "rose" : report.priority === "MEDIA" ? "amber" : "blue"}`}
        >
          {t("Prioridad")}
          {t(priorityLabels[report.priority])}
        </span>
      </div>
      <p style={{ color: "var(--muted)" }}>
        {report.description || t("Sin detalles adicionales.")}
      </p>
      <p style={{ fontSize: 12, color: "var(--muted)" }}>
        {t(report.category)} {t("· Reportó")} {report.reported_by_name} {t("·")}{" "}
        {date}
        {report.assigned_to
          ? t(" · Responsable: {value1}", { value1: report.assigned_to })
          : t(" · Sin responsable")}
        {report.estimated_cost !== null
          ? t(" · Estimado: {value1}", {
              value1: new Intl.NumberFormat(locale, {
                style: "currency",
                currency: "COP",
                maximumFractionDigits: 0,
              }).format(report.estimated_cost),
            })
          : ""}
      </p>
      <div className="actions">
        <label>
          {t("Estado")}
          <select
            aria-label={t("Estado de {value1}", { value1: report.title })}
            value={report.status}
            onChange={(event) =>
              void onStatusChange(
                event.target.value as MaintenanceStatus,
              ).catch((reason: unknown) =>
                toast(
                  reason instanceof Error
                    ? reason.message
                    : "No se pudo actualizar el estado.",
                ),
              )
            }
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {t(statusLabels[status])}
              </option>
            ))}
          </select>
        </label>
        {report.can_edit && (
          <>
            <details>
              <summary className="text-button">{t("Editar reporte")}</summary>
              <Form
                label={t("Guardar cambios")}
                success={t("Reporte actualizado.")}
                onSave={(form) => onUpdate(reportBody(form))}
              >
                <label>
                  {t("Título")}
                  <input
                    name="title"
                    defaultValue={report.title}
                    required
                    minLength={3}
                    maxLength={255}
                  />
                </label>
                <label>
                  {t("Detalles")}
                  <textarea
                    name="description"
                    defaultValue={report.description}
                    maxLength={2000}
                  />
                </label>
                <label>
                  {t("Categoría")}
                  <select name="category" defaultValue={report.category}>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {t(category)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("Prioridad")}
                  <select name="priority" defaultValue={report.priority}>
                    {priorities.map((priority) => (
                      <option key={priority} value={priority}>
                        {t(priorityLabels[priority])}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("Costo estimado")}
                  <input
                    name="estimated_cost"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={report.estimated_cost ?? ""}
                  />
                </label>
                <label>
                  {t("Asignado a")}
                  <select
                    name="assigned_membership_id"
                    defaultValue={report.assigned_membership_id ?? ""}
                  >
                    <option value="">{t("Sin asignar")}</option>
                    {members.map((member) => (
                      <option
                        key={member.membership_id}
                        value={member.membership_id}
                      >
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>
              </Form>
            </details>
            <ConfirmButton
              label={t("Eliminar")}
              description={t('¿Eliminar el reporte "{value1}"?', {
                value1: report.title,
              })}
              onConfirm={onDelete}
              success={t("Reporte eliminado.")}
              undo={onRestore}
            />
          </>
        )}
      </div>
    </article>
  );
}
