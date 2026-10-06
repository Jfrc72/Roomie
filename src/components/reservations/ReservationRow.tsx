"use client";
import { useLanguage } from "@/context/LanguageContext";
import { useRoomie } from "@/context/RoomieContext";
import { formatRange } from "@/lib/dates";
import { ConfirmButton } from "@/components/ui";
import type { Reservation } from "@/types";

export default function ReservationRow({
  reservation: r,
  onCancel,
}: {
  reservation: Reservation;
  onCancel: () => Promise<void>;
}) {
  const { t, locale } = useLanguage();
  const { session } = useRoomie();
  const ongoing = new Date(r.starts_at) <= new Date();
  return (
    <div className="invitation-row">
      <div>
        <strong>{r.resource}</strong>
        <small>
          {formatRange(r.starts_at, r.ends_at, locale)}
          {ongoing && t(" · En curso")}
        </small>
        <small>
          {r.user_id === session.user.id
            ? t("Tu reserva")
            : t("Reservado por {value1}{value2}", {
                value1: r.member,
                value2: r.member_active ? "" : t(" (ya no pertenece)"),
              })}
        </small>
      </div>
      {r.can_cancel && (
        <ConfirmButton
          label={t("Cancelar reserva")}
          description={t(
            "¿Cancelar esta reserva de {value1}? El horario quedará libre.",
            { value1: r.resource },
          )}
          onConfirm={onCancel}
        />
      )}
    </div>
  );
}
