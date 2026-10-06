"use client";
import { useLanguage } from "@/context/LanguageContext";
import { useState } from "react";
import { PenLine, ShieldCheck, Users, X } from "lucide-react";
import { useRules } from "@/hooks/useRules";
import { formatDate } from "@/lib/dates";
import { Empty, LoadingError, PageTitle } from "@/components/ui";
import RuleText from "@/components/rules/RuleText";
import CurrentRules from "@/components/rules/CurrentRules";
import RuleEditor from "@/components/rules/RuleEditor";
import RuleReports from "@/components/rules/RuleReports";

export default function RulesBoard({ homeId }: { homeId: string }) {
  const { t, locale } = useLanguage();
  const {
    admin,
    rules: data,
    error,
    reload,
    clauses,
    publish,
    accept,
    report,
    resolve,
    resolving,
  } = useRules(homeId);
  const [editing, setEditing] = useState(false);
  return (
    <>
      <PageTitle
        title={t("Acuerdos del hogar")}
        description={t("Pequeños acuerdos para una mejor convivencia.")}
        action={
          admin &&
          data && (
            <button
              className={editing ? "secondary" : undefined}
              onClick={() => setEditing(!editing)}
            >
              {editing ? <X size={17} /> : <PenLine size={17} />}
              {editing
                ? t("Cancelar")
                : data.current
                  ? t("Nueva versión")
                  : t("Redactar reglamento")}
            </button>
          )
        }
      />
      <div className="dashboard-main">
        {!data ? (
          <LoadingError error={t(error)} retry={reload} />
        ) : (
          <>
            {editing && (
              <RuleEditor
                homeId={homeId}
                current={data.current}
                onPublish={async (form) => {
                  await publish(form);
                  setEditing(false);
                }}
              />
            )}
            {!data.current ? (
              <section className="panel">
                <Empty title={t("Aún no hay reglamento")}>
                  {admin
                    ? t(
                        "Redacta la primera versión; el asistente puede sugerirte acuerdos.",
                      )
                    : t("Un administrador publicará la primera versión.")}
                </Empty>
              </section>
            ) : (
              <div className="settings-grid">
                <CurrentRules
                  rules={data}
                  current={data.current}
                  onAccept={() => accept(data.current!.id)}
                />
                <section className="panel">
                  <div className="section-title">
                    <h2>
                      <Users size={20} /> {t("Aceptaciones")}
                    </h2>
                    <span className="badge">
                      {data.acceptances.filter((a) => a.accepted_at).length}{" "}
                      {t("de")} {data.acceptances.length}
                    </span>
                  </div>
                  {data.acceptances.map((a) => (
                    <div className="invitation-row" key={a.membership_id}>
                      <div>
                        <strong>{a.name}</strong>
                        <small>
                          {a.accepted_at
                            ? t("Aceptó el {value1}", {
                                value1: formatDate(a.accepted_at, locale),
                              })
                            : t("Pendiente")}
                        </small>
                      </div>
                    </div>
                  ))}
                  <div className="info-note">
                    <ShieldCheck size={20} />
                    <p>
                      {t(
                        "Aceptar es un registro de que leíste esta versión; no es una firma electrónica certificada.",
                      )}
                    </p>
                  </div>
                </section>
              </div>
            )}
            {data.current && (
              <RuleReports
                rules={data}
                clauses={clauses}
                admin={admin}
                onReport={report}
                onResolve={resolve}
                resolving={resolving}
              />
            )}
            {!!data.history.length && (
              <section className="panel help">
                <h2>{t("Versiones anteriores")}</h2>
                {data.history.map((v) => (
                  <details key={v.id}>
                    <summary>
                      {" "}
                      {t("Versión")} {v.version} {"·"}{" "}
                      {formatDate(v.created_at, locale)} {"·"} {v.author}
                    </summary>
                    {v.notes && (
                      <p>
                        {t("Cambios:")} {v.notes}
                      </p>
                    )}
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
