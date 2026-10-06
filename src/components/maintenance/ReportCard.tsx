"use client";
import { formatCurrency } from "@/lib/money";
import { formatDay } from "@/lib/dates";
import { useLanguage } from "@/context/LanguageContext";
import { ConfirmButton, Form } from "@/components/ui";
import { useRoomie } from "@/context/RoomieContext";
import type { Member } from "@/types";
import type {
  MaintenanceReport,
  MaintenanceStatus,
} from "@/types/shared-modules";
import { categories } from "@/components/maintenance/fields";
import { priorities } from "@/components/maintenance/fields";
import { statuses } from "@/components/maintenance/fields";
import { statusLabels } from "@/components/maintenance/fields";
import { priorityLabels } from "@/components/maintenance/fields";
import { reportBody } from "@/components/maintenance/fields";

export default function ReportCard({
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
  const date = formatDay(report.created_at, locale);
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
        {t(report.category)} {t("· Reportó")} {report.reported_by_name} {"·"}{" "}
        {date}
        {report.assigned_to
          ? t(" · Responsable: {value1}", { value1: report.assigned_to })
          : t(" · Sin responsable")}
        {report.estimated_cost !== null
          ? t(" · Estimado: {value1}", {
              value1: formatCurrency(report.estimated_cost, locale),
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
