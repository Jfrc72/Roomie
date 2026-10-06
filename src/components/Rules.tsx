"use client";
import { useLanguage } from "@/context/LanguageContext";
import { useRoomie } from "@/context/RoomieContext";
import NoHome from "@/components/NoHome";
import RulesBoard from "@/components/rules/RulesBoard";

export default function Rules() {
  const { t } = useLanguage();
  const { session } = useRoomie();
  if (!session.activeHomeId)
    return (
      <NoHome
        title={t("Acuerdos del hogar")}
        description={t("Pequeños acuerdos para una mejor convivencia.")}
      >
        {t(
          "Crea tu apartamento o acepta una invitación para escribir sus acuerdos de convivencia.",
        )}
      </NoHome>
    );
  return <RulesBoard homeId={session.activeHomeId} />;
}
