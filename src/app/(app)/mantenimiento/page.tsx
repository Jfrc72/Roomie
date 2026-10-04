"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Wrench } from "lucide-react";
import { ConfirmButton, Empty, Form, LoadingError, PageTitle } from "@/components/ui";
import { useRoomie } from "@/context/RoomieContext";
import { useData } from "@/lib/use-data";
import { useMantenimiento, type MaintenanceFilters } from "@/hooks/useMantenimiento";
import type { Home, Member } from "@/types";
import type { MaintenancePriority, MaintenanceReport, MaintenanceStatus } from "@/types/shared-modules";

const categories = ["Plomería", "Electricidad", "Carpintería", "Electrodomésticos", "Estructura", "Otros"];
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
    estimated_cost: form.get("estimated_cost") ? Number(form.get("estimated_cost")) : null,
    priority: String(form.get("priority") ?? "MEDIA"),
    assigned_membership_id: String(form.get("assigned_membership_id") ?? "") || null,
  };
}

export default function MantenimientoPage() {
  const { session, toast } = useRoomie();
  const homeId = session.activeHomeId;
  const [filters, setFilters] = useState<MaintenanceFilters>({ status: "", priority: "", category: "" });
  const { data, loading, error, reload, create, update, remove, restore } = useMantenimiento(homeId, filters);
  const { data: home } = useData<Home & { members: Member[] }>(
    homeId ? `/homes/${homeId}` : "/session",
  );
  const members = home?.members ?? [];
  const setFilter = (key: keyof MaintenanceFilters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));

  if (!homeId)
    return <Empty title="Sin apartamento">Selecciona un apartamento para gestionar sus reportes de mantenimiento.</Empty>;
  if (loading && !data) return <LoadingError error={error} retry={reload} />;
  if (error && !data) return <LoadingError error={error} retry={reload} />;

  return (
    <div>
      <PageTitle
        title="Mantenimiento y reparaciones"
        description="Reporta daños, asigna responsables y sigue el progreso de las reparaciones."
      />
      {error && <p role="alert" className="error">{error}</p>}
      <div className="stats-grid" style={{ marginBottom: 22 }} aria-label="Resumen de reportes">
        {[
          { label: "Pendientes", value: data?.counts.pending ?? 0, icon: AlertTriangle },
          { label: "En progreso", value: data?.counts.in_progress ?? 0, icon: Clock },
          { label: "Resueltos", value: data?.counts.resolved ?? 0, icon: CheckCircle2 },
        ].map(({ label, value, icon: Icon }) => (
          <article className="stat-card" key={label}>
            <div className="section-title"><span>{label}</span><Icon size={17} aria-hidden="true" /></div>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-title">
            <h2><Wrench size={19} aria-hidden="true" /> Reportes</h2>
            <button className="secondary" type="button" onClick={reload}>Actualizar</button>
          </div>
          <div className="form" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
            <label>Estado
              <select value={filters.status} onChange={(event) => setFilter("status", event.target.value)}>
                <option value="">Todos</option>
                {statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
              </select>
            </label>
            <label>Prioridad
              <select value={filters.priority} onChange={(event) => setFilter("priority", event.target.value)}>
                <option value="">Todas</option>
                {priorities.map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}
              </select>
            </label>
            <label>Categoría
              <select value={filters.category} onChange={(event) => setFilter("category", event.target.value)}>
                <option value="">Todas</option>
                {categories.map((category) => <option key={category}>{category}</option>)}
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
                    update(report.id, { status })
                      .then(() => toast("Estado del reporte actualizado."))
                  }
                />
              ))}
            </div>
          ) : (
            <Empty title="No hay reportes">
              {filters.status || filters.priority || filters.category
                ? "No hay reportes que coincidan con estos filtros."
                : "Los problemas del apartamento que reporten aparecerán aquí."}
            </Empty>
          )}
        </section>
        <aside className="panel narrow">
          <h2>Reportar un daño</h2>
          <Form label="Enviar reporte" success="Reporte de mantenimiento creado." onSave={(form) => create(reportBody(form))}>
            <label>¿Qué necesita reparación?
              <input name="title" required minLength={3} maxLength={255} placeholder="Ej. Fuga en la cocina" />
            </label>
            <label>Categoría
              <select name="category" defaultValue="Otros">{categories.map((category) => <option key={category}>{category}</option>)}</select>
            </label>
            <label>Prioridad
              <select name="priority" defaultValue="MEDIA">{priorities.map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}</select>
            </label>
            <label>Costo estimado (COP, opcional)
              <input name="estimated_cost" type="number" min="0" step="0.01" />
            </label>
            <label>Asignar a (opcional)
              <select name="assigned_membership_id" defaultValue="">
                <option value="">Sin asignar</option>
                {members.map((member) => <option key={member.membership_id} value={member.membership_id}>{member.name}</option>)}
              </select>
            </label>
            <label>Detalles
              <textarea name="description" rows={4} maxLength={2000} placeholder="Describe el problema y dónde ocurre." />
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
  const { toast } = useRoomie();
  const date = new Date(report.created_at).toLocaleDateString("es-CO");
  return (
    <article className="panel" style={{ padding: 16 }}>
      <div className="section-title">
        <h3>{report.title}</h3>
        <span className={`badge ${report.priority === "URGENTE" || report.priority === "ALTA" ? "rose" : report.priority === "MEDIA" ? "amber" : "blue"}`}>
          Prioridad {priorityLabels[report.priority]}
        </span>
      </div>
      <p style={{ color: "var(--muted)" }}>{report.description || "Sin detalles adicionales."}</p>
      <p style={{ fontSize: 12, color: "var(--muted)" }}>
        {report.category} · Reportó {report.reported_by_name} · {date}
        {report.assigned_to ? ` · Responsable: ${report.assigned_to}` : " · Sin responsable"}
        {report.estimated_cost !== null ? ` · Estimado: ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(report.estimated_cost)}` : ""}
      </p>
      <div className="actions">
        <label>
          Estado
          <select
            aria-label={`Estado de ${report.title}`}
            value={report.status}
            onChange={(event) =>
              void onStatusChange(event.target.value as MaintenanceStatus).catch((reason: unknown) =>
                toast(reason instanceof Error ? reason.message : "No se pudo actualizar el estado."),
              )
            }
          >
            {statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
          </select>
        </label>
        {report.can_edit && (
          <>
            <details>
              <summary className="text-button">Editar reporte</summary>
              <Form label="Guardar cambios" success="Reporte actualizado." onSave={(form) => onUpdate(reportBody(form))}>
                <label>Título<input name="title" defaultValue={report.title} required minLength={3} maxLength={255} /></label>
                <label>Detalles<textarea name="description" defaultValue={report.description} maxLength={2000} /></label>
                <label>Categoría<select name="category" defaultValue={report.category}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
                <label>Prioridad<select name="priority" defaultValue={report.priority}>{priorities.map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}</select></label>
                <label>Costo estimado<input name="estimated_cost" type="number" min="0" step="0.01" defaultValue={report.estimated_cost ?? ""} /></label>
                <label>Asignado a
                  <select name="assigned_membership_id" defaultValue={report.assigned_membership_id ?? ""}>
                    <option value="">Sin asignar</option>
                    {members.map((member) => <option key={member.membership_id} value={member.membership_id}>{member.name}</option>)}
                  </select>
                </label>
              </Form>
            </details>
            <ConfirmButton
              label="Eliminar"
              description={`¿Eliminar el reporte "${report.title}"?`}
              onConfirm={onDelete}
              success="Reporte eliminado."
              undo={onRestore}
            />
          </>
        )}
      </div>
    </article>
  );
}
