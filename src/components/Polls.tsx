"use client";
import { useLanguage } from "@/context/LanguageContext";
import { useState } from "react";
import { Lock, Plus, X } from "lucide-react";
import { useRoomie } from "@/context/RoomieContext";
import { usePolls } from "@/hooks/usePolls";
import { formatDate, toDateInput } from "@/lib/dates";
import { pollResult, pollRules, ruleLabels } from "@/lib/polls";
import NoHome from "./NoHome";
import { ConfirmButton, Empty, Form, LoadingError, PageTitle } from "./ui";
import type { Poll } from "@/types";
const groups = [
  { status: "open", title: "Abiertas", empty: "No hay votaciones abiertas." },
  {
    status: "closed",
    title: "Cerradas",
    empty: "Aún no se ha cerrado ninguna votación.",
  },
] as const;
export default function Polls() {
  const { t } = useLanguage();
  const { session } = useRoomie();
  if (!session.activeHomeId)
    return (
      <NoHome
        title={t("Votaciones")}
        description={t("Las decisiones del hogar se toman en equipo.")}
      >
        {t(
          "Crea tu apartamento o acepta una invitación para decidir en equipo con tus roommates.",
        )}
      </NoHome>
    );
  return <PollBoard homeId={session.activeHomeId} />;
}
function PollBoard({ homeId }: { homeId: string }) {
  const { t } = useLanguage();
  const {
    polls,
    groups: lists,
    error,
    reload,
    createPoll,
    vote,
    closePoll,
  } = usePolls(homeId);
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageTitle
        title={t("Votaciones")}
        description={t("Las decisiones del hogar se toman en equipo.")}
        action={
          <button
            className={creating ? "secondary" : undefined}
            onClick={() => setCreating(!creating)}
          >
            {creating ? <X size={17} /> : <Plus size={17} />}
            {creating ? t("Cancelar") : t("Nueva votación")}
          </button>
        }
      />
      <div className="dashboard-main">
        {creating && (
          <section className="panel narrow">
            <h2>{t("Una decisión en común")}</h2>
            <Form
              label={t("Abrir votación")}
              success={t("Votación abierta.")}
              onSave={async (form) => {
                await createPoll(form);
                setCreating(false);
              }}
            >
              <label>
                {t("Pregunta")}
                <input
                  name="title"
                  placeholder={t("Ej. ¿De qué color pintamos la sala?")}
                  required
                  minLength={2}
                  maxLength={120}
                />
              </label>
              <label>
                {t("Detalles")}
                <textarea
                  name="description"
                  placeholder={t("Contexto para decidir")}
                  maxLength={500}
                  rows={2}
                />
              </label>
              <label>
                {t("Opciones")}
                <textarea
                  name="options"
                  placeholder={t("Azul\nVerde\nBlanco")}
                  required
                  rows={4}
                />
              </label>
              <small>
                {t("Una opción por línea: entre 2 y 10, sin repetir.")}
              </small>
              <label>
                {t("Cierre automático")}
                <input
                  name="closes_at"
                  type="datetime-local"
                  min={toDateInput(new Date().toISOString())}
                />
              </label>
              <small>
                {t(
                  "Opcional. Quien la crea o un administrador también pueden cerrarla antes.",
                )}
              </small>
              <label>
                {t("Tipo de decisión")}
                <select name="rule" defaultValue="simple">
                  {pollRules.map((rule) => (
                    <option key={rule} value={rule}>
                      {t(ruleLabels[rule])}
                    </option>
                  ))}
                </select>
              </label>
              <small>
                {t(
                  "Mayoría simple: gana la opción con más votos y un empate no tiene ganadora. Unanimidad: gana solo si todos los integrantes votan por la misma opción; una abstención basta para que no haya ganadora.",
                )}
              </small>
              <label className="check-label">
                <input type="checkbox" name="anonymous" />
                {t("Votación anónima")}
              </label>
              <small>
                {t(
                  "En una votación anónima nadie en Roomie verá qué eligió cada persona, solo los totales.",
                )}
              </small>
            </Form>
          </section>
        )}
        {!polls || !lists ? (
          <LoadingError error={t(error)} retry={reload} />
        ) : !polls.length ? (
          <section className="panel">
            <Empty title={t("Decidir juntos empieza aquí")}>
              {t("Propón una votación para que todos opinen antes de decidir.")}
            </Empty>
          </section>
        ) : (
          groups.map((g) => {
            const items = lists[g.status];
            return (
              <section
                key={g.status}
                aria-labelledby={`votaciones-${g.status}`}
              >
                <div className="section-title">
                  <h2 id={`votaciones-${g.status}`}>{g.title}</h2>
                  <span className="badge">{items.length}</span>
                </div>
                {items.length ? (
                  <div className="settings-grid">
                    {items.map((p) => (
                      <PollCard
                        key={p.id}
                        poll={p}
                        onVote={(form) => vote(p.id, form)}
                        onClose={() => closePoll(p.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <p>{g.empty}</p>
                )}
              </section>
            );
          })
        )}
      </div>
    </>
  );
}
function PollCard({
  poll: p,
  onVote,
  onClose,
}: {
  poll: Poll;
  onVote: (form: FormData) => Promise<void>;
  onClose: () => Promise<void>;
}) {
  const { t, locale } = useLanguage();
  return (
    <article className="panel">
      <div className="section-title">
        <h3>{p.title}</h3>
        <span className="badge">
          {p.anonymous ? t("Anónima") : t("Pública")}
        </span>
      </div>
      {p.description && <p>{p.description}</p>}
      <p>
        {t("Propuesta por")} {p.creator} {t("·")} {t(ruleLabels[p.rule])}{" "}
        {t("·")}{" "}
        {p.closed_at
          ? t("Cerrada {value1}", { value1: formatDate(p.closed_at, locale) })
          : p.closes_at
            ? t("Cierra {value1}", { value1: formatDate(p.closes_at, locale) })
            : t("Sin cierre automático")}
      </p>
      {p.status === "closed" ? (
        <PollResults poll={p} />
      ) : (
        <>
          <p>
            {p.voters} {t("de")} {p.eligible}{" "}
            {t("integrantes ya votaron. Los resultados se verán al cerrar.")}
          </p>
          <Form
            label={p.my_option_id ? t("Cambiar mi voto") : t("Votar")}
            success={t("Voto guardado.")}
            onSave={onVote}
          >
            <legend className="sr-only">
              {t("Opciones de")} {p.title}
            </legend>
            {p.options.map((o) => (
              <label className="check-label" key={o.id}>
                <input
                  type="radio"
                  name="option_id"
                  value={o.id}
                  defaultChecked={p.my_option_id === o.id}
                  required
                />
                {o.label}
              </label>
            ))}
            <small>
              {p.anonymous
                ? t("Tu voto es anónimo.")
                : t("Al cerrar, todos verán qué eligió cada persona.")}{" "}
              {t("Puedes cambiarlo mientras siga abierta.")}
            </small>
          </Form>
          {p.can_close && (
            <div className="info-note">
              <Lock size={20} />
              <ConfirmButton
                label={t("Cerrar votación")}
                description={t(
                  "¿Cerrar ahora? Ya no se podrá votar y se publicará el resultado.",
                )}
                onConfirm={onClose}
              />
            </div>
          )}
        </>
      )}
    </article>
  );
}
function PollResults({ poll: p }: { poll: Poll }) {
  const { t } = useLanguage();
  const { leaders, winner } = pollResult(p.options, p.rule, p.eligible);
  const abstentions = Math.max(0, p.eligible - p.voters);
  let headline = t("Nadie votó");
  if (winner)
    headline = t(
      p.rule === "unanimous"
        ? 'Ganó "{option}" por unanimidad'
        : 'Ganó "{option}"',
      { option: winner.label },
    );
  else if (p.rule === "unanimous" && leaders.length)
    headline = t("No hubo unanimidad: no hay ganadora");
  else if (leaders.length)
    headline = t("Empate entre {options}: no hay ganadora", {
      options: leaders.map((o) => `"${o.label}"`).join(", "),
    });
  return (
    <>
      <p>
        <strong>{headline}</strong>
      </p>
      {p.options.map((o) => (
        <div className="invitation-row" key={o.id}>
          <div>
            <strong>{o.label}</strong>
            <small>
              {o.votes} {o.votes === 1 ? t("voto") : t("votos")}
              {p.voters > 0 &&
                ` · ${Math.round(((o.votes ?? 0) * 100) / p.voters)} %`}
              {winner === o && t(" · Ganadora")}
            </small>
            {!!o.voters?.length && <small>{o.voters.join(", ")}</small>}
          </div>
        </div>
      ))}
      <p>
        {p.voters} {t("de")} {p.eligible} {t("votaron ·")} {abstentions}{" "}
        {abstentions === 1 ? t("abstención") : t("abstenciones")}
        {p.my_option_id &&
          t(" · Tu voto: {value1}", {
            value1: p.options.find((o) => o.id === p.my_option_id)?.label ?? "",
          })}
      </p>
    </>
  );
}
