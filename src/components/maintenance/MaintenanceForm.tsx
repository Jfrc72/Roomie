"use client";
import { useLanguage } from "@/context/LanguageContext";
import { Form } from "@/components/ui";
import type { Member } from "@/types";
import { categories } from "@/components/maintenance/fields";
import { priorities } from "@/components/maintenance/fields";
import { priorityLabels } from "@/components/maintenance/fields";
import { reportBody } from "@/components/maintenance/fields";

export default function MaintenanceForm({
  members,
  create,
}: {
  members: Member[];
  create: (body: unknown) => Promise<void>;
}) {
  const { t } = useLanguage();

  return (
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
              <option key={member.membership_id} value={member.membership_id}>
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
  );
}
