"use client";
import { formatDay } from "@/lib/dates";
import { useLanguage } from "@/context/LanguageContext";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { useRoomie } from "@/context/RoomieContext";
import { addDays, formatTime } from "@/lib/dates";
import { LoadingError } from "@/components/ui";
import type { Reservation } from "@/types";

export function WeekCalendar({
  weekStart,
  onChange,
  reservations,
  error,
  retry,
}: {
  weekStart: Date;
  onChange: (week: Date) => void;
  reservations: Reservation[] | null;
  error: string;
  retry: () => void;
}) {
  const { t, locale } = useLanguage();
  const { session } = useRoomie();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date().toDateString();
  return (
    <section className="panel" aria-labelledby="calendario-reservas">
      <div className="section-title">
        <h2 id="calendario-reservas">
          <CalendarRange size={20} /> {t("Semana del")}{" "}
          {formatDay(weekStart, locale, {
            day: "numeric",
            month: "short",
          })}{" "}
          {t("al")}{" "}
          {formatDay(days[6], locale, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </h2>
        <div className="actions">
          <button
            className="secondary"
            aria-label={t("Semana anterior")}
            onClick={() => onChange(addDays(weekStart, -7))}
          >
            <ChevronLeft size={17} />
          </button>
          <button className="secondary" onClick={() => onChange(new Date())}>
            {t("Esta semana")}
          </button>
          <button
            className="secondary"
            aria-label={t("Semana siguiente")}
            onClick={() => onChange(addDays(weekStart, 7))}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      {!reservations ? (
        <LoadingError error={t(error)} retry={retry} />
      ) : (
        <ol className="week-calendar">
          {days.map((day) => {
            const end = addDays(day, 1);
            const items = reservations.filter(
              (r) => new Date(r.starts_at) < end && new Date(r.ends_at) > day,
            );
            const isToday = day.toDateString() === today;
            return (
              <li
                key={day.toISOString()}
                className={`week-day${isToday ? " is-today" : ""}`}
              >
                <h3>
                  {formatDay(day, locale, {
                    weekday: "long",
                    day: "numeric",
                  })}
                  {isToday && <span className="badge">{t("Hoy")}</span>}
                </h3>
                {items.length ? (
                  <ul>
                    {items.map((r) => (
                      <li key={r.id}>
                        <strong>{slot(r, day, end, locale, t)}</strong>
                        <span>{r.resource}</span>
                        <small>
                          {r.user_id === session.user.id
                            ? t("Tu reserva")
                            : r.member}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{t("Sin reservas")}</p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function slot(
  reservation: Reservation,
  day: Date,
  end: Date,
  locale: string,
  t: ReturnType<typeof useLanguage>["t"],
) {
  const from = new Date(reservation.starts_at);
  const to = new Date(reservation.ends_at);
  if (from <= day && to >= end) return t("Todo el día");
  if (from <= day) return t("Hasta {time}", { time: formatTime(to, locale) });
  if (to >= end) return t("Desde {time}", { time: formatTime(from, locale) });
  return `${formatTime(from, locale)} – ${formatTime(to, locale)}`;
}
