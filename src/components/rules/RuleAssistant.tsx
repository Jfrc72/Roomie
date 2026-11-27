"use client";
import { useLanguage } from "@/context/LanguageContext";
import { Sparkles, UserRound } from "lucide-react";
import { useRuleAssistant } from "@/hooks/useRuleAssistant";
import { assistantExamples } from "@/lib/assistant";
import RuleText from "@/components/rules/RuleText";

export default function RuleAssistant({
  homeId,
  draft,
  members,
  onAdd,
}: {
  homeId: string;
  draft: string;
  members: string[];
  onAdd: (clause: string) => void;
}) {
  const { t } = useLanguage();
  const { prompt, setPrompt, turns, loading, ask, mode, model } =
    useRuleAssistant(homeId, draft, members);
  const busy = loading || !mode;
  return (
    <section className="panel">
      <div className="section-title">
        <h2>
          <Sparkles size={20} /> {t("Asistente de acuerdos")}
        </h2>
        {mode && (
          <span className="badge" title={model ?? undefined}>
            {mode === "ai" ? t("IA con Claude") : t("IA simulada")}
          </span>
        )}
      </div>
      <p>
        {mode === "ai"
          ? t(
              "Pídele ideas para el reglamento o que revise tu borrador. Tu petición, el borrador y los nombres de los integrantes se envían a Claude, de Anthropic, para generar la respuesta. Revisa las sugerencias antes de publicarlas.",
            )
          : t(
              "Pídele ideas para el reglamento o que revise tu borrador. Las respuestas son de demostración y no provienen de un modelo real.",
            )}
      </p>
      <div aria-live="polite" aria-busy={loading}>
        {turns.map((turn, i) => (
          <div key={i}>
            <div className="info-note">
              <UserRound size={18} />
              <p>{turn.prompt}</p>
            </div>
            {turn.reply ? (
              <div className="invite-result">
                <strong className="assistant-thinking">
                  <Sparkles size={15} /> {t("Asistente")}
                </strong>
                <p>{turn.reply.text}</p>
                {turn.reply.clauses.map((clause) => (
                  <div className="invitation-row" key={clause}>
                    <RuleText text={clause} />
                    <button
                      type="button"
                      className="text-button"
                      disabled={draft.includes(clause)}
                      onClick={() => onAdd(clause)}
                    >
                      {draft.includes(clause)
                        ? t("En el borrador")
                        : t("Agregar al borrador")}
                    </button>
                  </div>
                ))}
              </div>
            ) : turn.error ? (
              <div className="invite-result">
                <p className="error" role="alert">
                  {t(turn.error)}
                </p>
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => ask(turn.prompt)}
                >
                  {t("Reintentar")}
                </button>
              </div>
            ) : (
              <div className="invite-result" role="status">
                <span className="assistant-thinking">
                  <span className="spinner" aria-hidden="true" />
                  {t("El asistente está redactando…")}
                </span>
                <span className="skeleton" aria-hidden="true" />
                <span className="skeleton" aria-hidden="true" />
                <span className="skeleton short" aria-hidden="true" />
              </div>
            )}
          </div>
        ))}
      </div>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          ask(prompt);
        }}
      >
        <label>
          {t("Tu petición")}
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t("Ej. Necesitamos reglas para las visitas")}
            maxLength={300}
            disabled={busy}
          />
        </label>
        <div className="actions">
          {assistantExamples.map((example) => (
            <button
              key={example}
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => ask(t(example))}
            >
              {t(example)}
            </button>
          ))}
        </div>
        <button type="submit" disabled={busy || !prompt.trim()}>
          {loading ? t("Generando…") : t("Pedir sugerencias")}
        </button>
      </form>
    </section>
  );
}
