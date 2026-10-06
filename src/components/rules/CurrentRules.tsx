"use client";
import { useLanguage } from "@/context/LanguageContext";
import { BookOpen, CircleCheck } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { Form } from "@/components/ui";
import type { Rules as RulesData, RuleVersion } from "@/types";
import RuleText from "@/components/rules/RuleText";

export default function CurrentRules({
  rules,
  current,
  onAccept,
}: {
  rules: RulesData;
  current: RuleVersion;
  onAccept: () => Promise<void>;
}) {
  const { t, locale } = useLanguage();
  return (
    <section className="panel">
      <div className="section-title">
        <h2>
          <BookOpen size={20} /> {t("Versión")} {current.version}
        </h2>
        <span className="badge">{t("Vigente")}</span>
      </div>
      <p>
        {t("Publicada por")} {current.author} {t("el")}{" "}
        {formatDate(current.created_at, locale)}
        {"."}
        {current.notes && t(" Cambios: {value1}", { value1: current.notes })}
      </p>
      <RuleText text={current.content} />
      {rules.accepted_by_me ? (
        <div className="info-note">
          <CircleCheck size={20} />
          <p>{t("Ya aceptaste esta versión.")}</p>
        </div>
      ) : (
        <Form
          label={t("Aceptar reglamento")}
          success={t("Aceptaste el reglamento.")}
          onSave={onAccept}
        >
          <label className="check-label">
            <input type="checkbox" required />
            {t("Leí y acepto la versión")} {current.version}
          </label>
        </Form>
      )}
    </section>
  );
}
