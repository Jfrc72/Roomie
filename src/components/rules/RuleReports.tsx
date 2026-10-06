"use client";
import { useLanguage } from "@/context/LanguageContext";
import { useState } from "react";
import { Flag } from "lucide-react";
import { useRoomie } from "@/context/RoomieContext";
import { formatDate } from "@/lib/dates";
import { Form } from "@/components/ui";
import type { Rules as RulesData } from "@/types";

export default function RuleReports({
  rules,
  clauses,
  admin,
  onReport,
  onResolve,
  resolving,
}: {
  rules: RulesData;
  clauses: string[];
  admin: boolean;
  onReport: (form: FormData) => Promise<void>;
  onResolve: (reportId: string) => Promise<void>;
  resolving: string;
}) {
  const { t, locale } = useLanguage();
  const { session } = useRoomie();
  const [formKey, setFormKey] = useState(0);
  const pending = rules.reports.filter((r) => !r.resolved_at).length;
  return (
    <div className="settings-grid">
      <section className="panel">
        <div className="section-title">
          <h2>
            <Flag size={20} /> {t("Reportar incumplimiento")}
          </h2>
        </div>
        <p>
          {t(
            "Avisa a los administradores y, si la indicas, a la persona que no cumplió el acuerdo. El reporte muestra tu nombre.",
          )}
        </p>
        {/* La key nueva limpia el formulario después de enviar. */}
        <Form
          key={formKey}
          label={t("Enviar reporte")}
          success={t("Reporte enviado.")}
          onSave={async (form) => {
            await onReport(form);
            setFormKey((v) => v + 1);
          }}
        >
          <label>
            {t("Acuerdo incumplido")}
            <select name="clause" required>
              {clauses.map((clause) => (
                <option key={clause} value={clause.slice(0, 300)}>
                  {clause.length > 90 ? `${clause.slice(0, 89)}…` : clause}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Quién no lo cumplió (opcional)")}
            <select name="reported" defaultValue="">
              <option value="">{t("Sin señalar a nadie")}</option>
              {rules.acceptances
                .filter((m) => m.user_id !== session.user.id)
                .map((m) => (
                  <option key={m.membership_id} value={m.membership_id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            {t("Qué pasó")}
            <textarea
              name="description"
              placeholder={t("Ej. La loza quedó sucia toda la noche")}
              maxLength={500}
              rows={3}
            />
          </label>
        </Form>
      </section>
      <section className="panel">
        <div className="section-title">
          <h2>{t("Reportes")}</h2>
          <span className="badge">
            {pending} {pending === 1 ? t("pendiente") : t("pendientes")}
          </span>
        </div>
        {rules.reports.length ? (
          rules.reports.map((r) => (
            <div className="invitation-row" key={r.id}>
              <div>
                <strong>{r.clause}</strong>
                {r.description && <small>{r.description}</small>}
                <small>
                  {t("Reportó")} {r.reporter}
                  {r.reported &&
                    t(" · Señalado: {value1}", { value1: r.reported })}{" "}
                  {"·"} {formatDate(r.created_at, locale)}
                </small>
                <small>
                  {r.resolved_at
                    ? t("Resuelto el {value1}", {
                        value1: formatDate(r.resolved_at, locale),
                      })
                    : t("Pendiente")}
                </small>
              </div>
              {admin && !r.resolved_at && (
                <button
                  className="text-button"
                  disabled={resolving === r.id}
                  onClick={() => onResolve(r.id)}
                >
                  {t("Marcar resuelto")}
                </button>
              )}
            </div>
          ))
        ) : (
          <p>{t("No hay incumplimientos reportados.")}</p>
        )}
      </section>
    </div>
  );
}
