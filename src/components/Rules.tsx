"use client";
import Link from "next/link";
import { Fragment, useState } from "react";
import {
  BookOpen,
  CircleCheck,
  Flag,
  PenLine,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useRoomie } from "@/context/RoomieContext";
import { api } from "@/lib/api";
import {
  askAssistant,
  assistantExamples,
  type AssistantReply,
} from "@/lib/assistant";
import { formatDate } from "@/lib/dates";
import { useData } from "@/lib/use-data";
import { Empty, Form, LoadingError, PageTitle } from "./ui";
import type { Rules as RulesData, RuleVersion } from "@/types";
// Un párrafo por bloque separado con línea en blanco; los saltos simples se conservan.
function RuleText({ text }: { text: string }) {
  return (
    <div>
      {text.split(/\n\s*\n/).map((block, i) => (
        <p key={i}>
          {block.split("\n").map((line, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {line}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
export default function Rules() {
  const { session } = useRoomie();
  if (!session.activeHomeId)
    return (
      <>
        <PageTitle
          title="Acuerdos del hogar"
          description="Pequeños acuerdos para una mejor convivencia."
        />
        <section className="panel">
          <Empty title="Primero, un hogar">
            Crea tu apartamento o acepta una invitación para escribir sus
            acuerdos de convivencia.
          </Empty>
          <Link className="button" href="/apartamento">
            Crear mi apartamento
          </Link>
        </section>
      </>
    );
  return <RulesBoard homeId={session.activeHomeId} />;
}
function RulesBoard({ homeId }: { homeId: string }) {
  const { session } = useRoomie();
  const admin = session.homes.find((h) => h.id === homeId)?.role === "admin";
  const rules = useData<RulesData>(`/rules?homeId=${homeId}`);
  const data = rules.data;
  const [editing, setEditing] = useState(false);
  return (
    <>
      <PageTitle
        title="Acuerdos del hogar"
        description="Pequeños acuerdos para una mejor convivencia."
        action={
          admin &&
          data && (
            <button
              className={editing ? "secondary" : undefined}
              onClick={() => setEditing(!editing)}
            >
              {editing ? <X size={17} /> : <PenLine size={17} />}
              {editing
                ? "Cancelar"
                : data.current
                  ? "Nueva versión"
                  : "Redactar reglamento"}
            </button>
          )
        }
      />
      <div className="dashboard-main">
        {!data ? (
          <LoadingError error={rules.error} retry={rules.reload} />
        ) : (
          <>
            {editing && (
              <RuleEditor
                homeId={homeId}
                current={data.current}
                onPublished={() => {
                  setEditing(false);
                  rules.reload();
                }}
              />
            )}
            {!data.current ? (
              <section className="panel">
                <Empty title="Aún no hay reglamento">
                  {admin
                    ? "Redacta la primera versión; el asistente puede sugerirte acuerdos."
                    : "Un administrador publicará la primera versión."}
                </Empty>
              </section>
            ) : (
              <div className="settings-grid">
                <CurrentRules
                  rules={data}
                  current={data.current}
                  onChanged={rules.reload}
                />
                <section className="panel">
                  <div className="section-title">
                    <h2>
                      <Users size={20} /> Aceptaciones
                    </h2>
                    <span className="badge">
                      {data.acceptances.filter((a) => a.accepted_at).length} de{" "}
                      {data.acceptances.length}
                    </span>
                  </div>
                  {data.acceptances.map((a) => (
                    <div className="invitation-row" key={a.membership_id}>
                      <div>
                        <strong>{a.name}</strong>
                        <small>
                          {a.accepted_at
                            ? `Aceptó el ${formatDate(a.accepted_at)}`
                            : "Pendiente"}
                        </small>
                      </div>
                    </div>
                  ))}
                  <div className="info-note">
                    <ShieldCheck size={20} />
                    <p>
                      Aceptar es un registro de que leíste esta versión; no es
                      una firma electrónica certificada.
                    </p>
                  </div>
                </section>
              </div>
            )}
            {data.current && (
              <RuleReports
                homeId={homeId}
                rules={data}
                current={data.current}
                admin={admin}
                onChanged={rules.reload}
              />
            )}
            {!!data.history.length && (
              <section className="panel help">
                <h2>Versiones anteriores</h2>
                {data.history.map((v) => (
                  <details key={v.id}>
                    <summary>
                      Versión {v.version} · {formatDate(v.created_at)} ·{" "}
                      {v.author}
                    </summary>
                    {v.notes && <p>Cambios: {v.notes}</p>}
                    <RuleText text={v.content} />
                  </details>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
function CurrentRules({
  rules,
  current,
  onChanged,
}: {
  rules: RulesData;
  current: RuleVersion;
  onChanged: () => void;
}) {
  return (
    <section className="panel">
      <div className="section-title">
        <h2>
          <BookOpen size={20} /> Versión {current.version}
        </h2>
        <span className="badge">Vigente</span>
      </div>
      <p>
        Publicada por {current.author} el {formatDate(current.created_at)}.
        {current.notes && ` Cambios: ${current.notes}`}
      </p>
      <RuleText text={current.content} />
      {rules.accepted_by_me ? (
        <div className="info-note">
          <CircleCheck size={20} />
          <p>Ya aceptaste esta versión.</p>
        </div>
      ) : (
        <Form
          label="Aceptar reglamento"
          success="Aceptaste el reglamento."
          onSave={async () => {
            await api(`/rules/${current.id}/accept`, "POST", {});
            onChanged();
          }}
        >
          <label className="check-label">
            <input type="checkbox" required />
            Leí y acepto la versión {current.version}
          </label>
        </Form>
      )}
    </section>
  );
}
function RuleEditor({
  homeId,
  current,
  onPublished,
}: {
  homeId: string;
  current: RuleVersion | null;
  onPublished: () => void;
}) {
  const [draft, setDraft] = useState(current?.content ?? "");
  return (
    <div className="settings-grid">
      <section className="panel">
        <h2>
          {current ? `Versión ${current.version + 1}` : "Primera versión"}
        </h2>
        <p>
          Al publicarla, cada integrante deberá aceptarla
          {current ? " de nuevo" : ""}.
        </p>
        <Form
          label="Publicar versión"
          success="Versión publicada."
          onSave={async (form) => {
            await api(`/rules?homeId=${homeId}`, "POST", {
              content: form.get("content"),
              notes: form.get("notes"),
            });
            onPublished();
          }}
        >
          <label>
            Texto del reglamento
            <textarea
              name="content"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escribe un acuerdo por párrafo. El asistente puede ayudarte."
              required
              minLength={10}
              maxLength={10000}
              rows={14}
            />
          </label>
          <small>Separa cada acuerdo con una línea en blanco.</small>
          <label>
            Qué cambió
            <input
              name="notes"
              placeholder={
                current ? "Ej. Se agregan horarios de silencio" : "Opcional"
              }
              maxLength={200}
            />
          </label>
        </Form>
      </section>
      <RuleAssistant
        draft={draft}
        onAdd={(clause) =>
          setDraft((d) => (d.trim() ? `${d.trimEnd()}\n\n${clause}` : clause))
        }
      />
    </div>
  );
}
// Única funcionalidad con IA (simulada): recibe una petición, muestra un estado de carga
// mientras "genera" y responde con cláusulas que se pueden agregar al borrador.
function RuleAssistant({
  draft,
  onAdd,
}: {
  draft: string;
  onAdd: (clause: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState<
    { prompt: string; reply: AssistantReply | null }[]
  >([]);
  const loading = turns.length > 0 && !turns[turns.length - 1].reply;
  async function ask(text: string) {
    const question = text.trim();
    if (!question || loading) return;
    setPrompt("");
    setTurns((t) => [...t, { prompt: question, reply: null }]);
    const reply = await askAssistant(question, draft);
    setTurns((t) =>
      t.map((turn, i) => (i === t.length - 1 ? { ...turn, reply } : turn)),
    );
  }
  return (
    <section className="panel">
      <div className="section-title">
        <h2>
          <Sparkles size={20} /> Asistente de acuerdos
        </h2>
        <span className="badge">IA simulada</span>
      </div>
      <p>
        Pídele ideas para el reglamento o que revise tu borrador. Las respuestas
        son de demostración y no provienen de un modelo real.
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
                  <Sparkles size={15} /> Asistente
                </strong>
                <p>{turn.reply.text}</p>
                {turn.reply.clauses.map((clause) => (
                  <div className="invitation-row" key={clause}>
                    <span>{clause}</span>
                    <button
                      type="button"
                      className="text-button"
                      disabled={draft.includes(clause)}
                      onClick={() => onAdd(clause)}
                    >
                      {draft.includes(clause)
                        ? "En el borrador"
                        : "Agregar al borrador"}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="invite-result" role="status">
                <span className="assistant-thinking">
                  <span className="spinner" aria-hidden="true" />
                  El asistente está redactando…
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
          Tu petición
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ej. Necesitamos reglas para las visitas"
            maxLength={300}
            disabled={loading}
          />
        </label>
        <div className="actions">
          {assistantExamples.map((example) => (
            <button
              key={example}
              type="button"
              className="text-button"
              disabled={loading}
              onClick={() => ask(example)}
            >
              {example}
            </button>
          ))}
        </div>
        <button type="submit" disabled={loading || !prompt.trim()}>
          {loading ? "Generando…" : "Pedir sugerencias"}
        </button>
      </form>
    </section>
  );
}
// Reportar que no se cumplió un acuerdo del reglamento vigente y seguir su resolución.
function RuleReports({
  homeId,
  rules,
  current,
  admin,
  onChanged,
}: {
  homeId: string;
  rules: RulesData;
  current: RuleVersion;
  admin: boolean;
  onChanged: () => void;
}) {
  const { session, toast } = useRoomie();
  const [formKey, setFormKey] = useState(0);
  const [busy, setBusy] = useState("");
  // Cada párrafo del reglamento es un acuerdo que se puede elegir.
  const clauses = current.content
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const pending = rules.reports.filter((r) => !r.resolved_at).length;
  async function resolve(id: string) {
    setBusy(id);
    try {
      await api(`/rules/reports/${id}/resolve`, "POST", {});
      toast("Reporte resuelto.");
      onChanged();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="settings-grid">
      <section className="panel">
        <div className="section-title">
          <h2>
            <Flag size={20} /> Reportar incumplimiento
          </h2>
        </div>
        <p>
          Avisa a los administradores y, si la indicas, a la persona que no
          cumplió el acuerdo. El reporte muestra tu nombre.
        </p>
        {/* La key nueva limpia el formulario después de enviar. */}
        <Form
          key={formKey}
          label="Enviar reporte"
          success="Reporte enviado."
          onSave={async (form) => {
            await api(`/rules/reports?homeId=${homeId}`, "POST", {
              clause: form.get("clause"),
              description: form.get("description"),
              reported_membership_id: form.get("reported") || null,
            });
            setFormKey((v) => v + 1);
            onChanged();
          }}
        >
          <label>
            Acuerdo incumplido
            <select name="clause" required>
              {clauses.map((clause) => (
                <option key={clause} value={clause.slice(0, 300)}>
                  {clause.length > 90 ? `${clause.slice(0, 89)}…` : clause}
                </option>
              ))}
            </select>
          </label>
          <label>
            Quién no lo cumplió (opcional)
            <select name="reported" defaultValue="">
              <option value="">Sin señalar a nadie</option>
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
            Qué pasó
            <textarea
              name="description"
              placeholder="Ej. La loza quedó sucia toda la noche"
              maxLength={500}
              rows={3}
            />
          </label>
        </Form>
      </section>
      <section className="panel">
        <div className="section-title">
          <h2>Reportes</h2>
          <span className="badge">
            {pending} {pending === 1 ? "pendiente" : "pendientes"}
          </span>
        </div>
        {rules.reports.length ? (
          rules.reports.map((r) => (
            <div className="invitation-row" key={r.id}>
              <div>
                <strong>{r.clause}</strong>
                {r.description && <small>{r.description}</small>}
                <small>
                  Reportó {r.reporter}
                  {r.reported && ` · Señalado: ${r.reported}`} ·{" "}
                  {formatDate(r.created_at)}
                </small>
                <small>
                  {r.resolved_at
                    ? `Resuelto el ${formatDate(r.resolved_at)}`
                    : "Pendiente"}
                </small>
              </div>
              {admin && !r.resolved_at && (
                <button
                  className="text-button"
                  disabled={busy === r.id}
                  onClick={() => resolve(r.id)}
                >
                  Marcar resuelto
                </button>
              )}
            </div>
          ))
        ) : (
          <p>No hay incumplimientos reportados.</p>
        )}
      </section>
    </div>
  );
}
