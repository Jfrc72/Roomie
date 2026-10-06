"use client";
import { useLanguage } from "@/context/LanguageContext";
import { useRoomie } from "@/context/RoomieContext";
import NoHome from "@/components/NoHome";
import ReservationBoard from "@/components/reservations/ReservationBoard";

export default function Reservations() {
  const { t } = useLanguage();
  const { session } = useRoomie();
  if (!session.activeHomeId)
    return (
      <NoHome
        title={t("Reservas")}
        description={t("Un momento para cada persona, sin cruces.")}
      >
        {t(
          "Crea tu apartamento o acepta una invitación para reservar los espacios que comparten.",
        )}
      </NoHome>
    );
  return <ReservationBoard homeId={session.activeHomeId} />;
}
