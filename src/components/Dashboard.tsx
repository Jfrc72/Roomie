"use client";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import {
  Wallet,
  ListChecks,
  ShoppingBasket,
  CalendarDays,
  ArrowUpRight,
  Users,
  Sparkles,
} from "lucide-react";
import { useRoomie } from "@/context/RoomieContext";
import { useData } from "@/lib/use-data";
import { Empty, LoadingError, PageTitle } from "./ui";
import type { Activity, DashboardSummary } from "@/types";
export default function Dashboard() {
  const { t } = useLanguage();
  const { session } = useRoomie();
  if (!session.activeHomeId)
    return (
      <>
        <PageTitle
          title={t("¡Hola, {name}!", { name: session.user.name.split(" ")[0] })}
          description={t("El primer paso para convivir mejor empieza aquí.")}
        />
        <div className="welcome panel">
          <div className="welcome-icon">
            <Users size={38} />
          </div>
          <h2>{t("Un nuevo hogar, un buen comienzo.")}</h2>
          <p>
            {t(
              "Crea tu apartamento e invita a tus roommates para tener un espacio compartido.",
            )}
          </p>
          <Link href="/apartamento" className="button">
            {t("Crear mi apartamento")}
          </Link>
          <small>
            {t(
              "¿Te invitaron? Abre el enlace que te compartió el administrador.",
            )}
          </small>
        </div>
      </>
    );
  return <HomeDashboard homeId={session.activeHomeId} />;
}
function HomeDashboard({ homeId }: { homeId: string }) {
  const { t, locale } = useLanguage();
  const { session } = useRoomie();
  const { data, error, reload } = useData<{
    summary: DashboardSummary;
    activities: Activity[];
  }>(`/homes/${homeId}/dashboard`);
  if (!data) return <LoadingError error={error} retry={reload} />;
  const s = data.summary;
  const cards = [
    {
      title: "Tu balance",
      value:
        s.balance === null
          ? "—"
          : new Intl.NumberFormat(locale, {
              style: "currency",
              currency: "COP",
              maximumFractionDigits: 0,
            }).format(s.balance),
      hint:
        s.balance === null
          ? "Aún no hay información financiera"
          : "Tu balance con integrantes",
      icon: Wallet,
      color: "rose",
      href: "/gastos",
    },
    {
      title: "Tareas pendientes",
      value: s.pendingTasks ?? "—",
      hint:
        s.pendingTasks === null
          ? "Tu organización empieza pronto"
          : "Asignadas a ti",
      icon: ListChecks,
      color: "purple",
      href: "/tareas",
    },
    {
      title: "Lista de compras",
      value: s.shoppingItems ?? "—",
      hint:
        s.shoppingItems === null
          ? "Todo lo que necesitan, en un lugar"
          : "Productos por comprar",
      icon: ShoppingBasket,
      color: "amber",
      href: "/compras",
    },
    {
      title: "Próxima reserva",
      value: s.nextReservation ?? "—",
      hint: s.nextReservation
        ? "En tu apartamento"
        : "Sin reservas para mostrar",
      icon: CalendarDays,
      color: "blue",
      href: "/reservas",
    },
    {
      title: "Mantenimiento urgente",
      value: s.urgentMaintenance,
      hint: "Reportes de prioridad alta o urgente",
      icon: Sparkles,
      color: "rose",
      href: "/mantenimiento",
    },
  ];
  return (
    <>
      <PageTitle
        title={t("¡Hola, {name}!", { name: session.user.name.split(" ")[0] })}
        description={t("Esto es lo que está pasando en tu hogar.")}
        action={
          <span className="date-label">
            {new Intl.DateTimeFormat(locale, {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(new Date())}
          </span>
        }
      />
      <div className="stats-grid">
        {cards.map(({ title, value, hint, icon: Icon, color, href }) => (
          <Link className="stat-card" href={href} key={title}>
            <div className="stat-top">
              <span className={`stat-icon ${color}`}>
                <Icon size={19} />
              </span>
              <ArrowUpRight size={17} />
            </div>
            <p>{t(title)}</p>
            <strong>{value}</strong>
            <small>{t(hint)}</small>
          </Link>
        ))}
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <section className="panel">
            <div className="section-title">
              <h2>{t("Tus tareas")}</h2>
              <Link href="/tareas">
                {t("Ver todas")} <ArrowUpRight size={14} />
              </Link>
            </div>
            {s.tasks.length ? (
              s.tasks.map((t) => (
                <Link className="summary-row" href={t.href} key={t.id}>
                  <span>{t.title}</span>
                  <small>{t.due}</small>
                </Link>
              ))
            ) : (
              <Empty title={t("Todo listo para organizarse")}>
                {t("Aquí aparecerán las responsabilidades que te asignen.")}
              </Empty>
            )}
          </section>
          <section className="panel">
            <div className="section-title">
              <h2>{t("Gastos recientes")}</h2>
              <Link href="/gastos">
                {t("Ver historial")} <ArrowUpRight size={14} />
              </Link>
            </div>
            {s.expenses.length ? (
              s.expenses.map((e) => (
                <Link className="summary-row" href={e.href} key={e.id}>
                  <span>{e.title}</span>
                  <strong>
                    {new Intl.NumberFormat(locale, {
                      style: "currency",
                      currency: "COP",
                    }).format(e.amount)}
                  </strong>
                </Link>
              ))
            ) : (
              <Empty title={t("Las cuentas, en un mismo lugar")}>
                {t("Los gastos del hogar aparecerán aquí cuando se registren.")}
              </Empty>
            )}
          </section>
        </div>
        <aside>
          <section className="panel activity-panel">
            <div className="section-title">
              <h2>{t("Actividad reciente")}</h2>
              <span className="tiny-dot" />
            </div>
            {data.activities.length ? (
              <ol className="activity-list">
                {data.activities.map((a) => (
                  <li key={a.id}>
                    <span className="activity-avatar">
                      {(a.actor || "R").slice(0, 1)}
                    </span>
                    <div>
                      <p>
                        <strong>{a.actor || t("Roomie")}</strong> {t(a.message)}
                      </p>
                      <time>
                        {new Date(a.created_at).toLocaleString(locale, {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty title={t("Una nueva historia")}>
                {t("Las novedades de tu apartamento aparecerán aquí.")}
              </Empty>
            )}
          </section>
          <section className="tip-card">
            <Sparkles size={21} />
            <h3>{t("Compartir también es acordar")}</h3>
            <p>
              {t(
                "Invita a tus roommates y construyan juntos una mejor rutina.",
              )}
            </p>
            <Link href="/apartamento">{t("Conocer mi hogar →")}</Link>
          </section>
        </aside>
      </div>
    </>
  );
}
