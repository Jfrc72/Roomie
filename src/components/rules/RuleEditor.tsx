"use client";
import { useLanguage } from "@/context/LanguageContext";
import { useState } from "react";
import { useHomeMembers } from "@/hooks/useHomeMembers";
import { Form } from "@/components/ui";
import type { RuleVersion } from "@/types";
import RuleAssistant from "@/components/rules/RuleAssistant";

export default function RuleEditor({
  homeId,
  current,
  onPublish,
}: {
  homeId: string;
  current: RuleVersion | null;
  onPublish: (form: FormData) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(current?.content ?? "");
  // Con los nombres reales, el asistente propone repartos concretos.
  const { members } = useHomeMembers(homeId);
  return (
    <div className="settings-grid">
      <section className="panel">
        <h2>
          {current
            ? t("Versión {value1}", { value1: current.version + 1 })
            : t("Primera versión")}
        </h2>
        <p>
          {t("Al publicarla, cada integrante deberá aceptarla")}
          {current ? t(" de nuevo") : ""}
          {"."}
        </p>
        <Form
          label={t("Publicar versión")}
          success={t("Versión publicada.")}
          onSave={onPublish}
        >
          <label>
            {t("Texto del reglamento")}
            <textarea
              name="content"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t(
                "Escribe un acuerdo por párrafo. El asistente puede ayudarte.",
              )}
              required
              minLength={10}
              maxLength={10000}
              rows={14}
            />
          </label>
          <small>{t("Separa cada acuerdo con una línea en blanco.")}</small>
          <label>
            {t("Qué cambió")}
            <input
              name="notes"
              placeholder={
                current
                  ? t("Ej. Se agregan horarios de silencio")
                  : t("Opcional")
              }
              maxLength={200}
            />
          </label>
        </Form>
      </section>
      <RuleAssistant
        draft={draft}
        members={members?.map((m) => m.name) ?? []}
        onAdd={(clause) =>
          setDraft((d) => (d.trim() ? `${d.trimEnd()}\n\n${clause}` : clause))
        }
      />
    </div>
  );
}
