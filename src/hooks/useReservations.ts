"use client";
import { useRoomie } from "@/context/RoomieContext";
import { api } from "@/lib/api";
import { addDays, fromDateInput, startOfWeek, toDateInput } from "@/lib/dates";
import { useData } from "@/lib/use-data";
import { useUrlState } from "./useUrlState";
import type { Reservation, Resource } from "@/types";

// Reservas: recursos, próximas reservas, semana del calendario y filtros (guardados en la URL)
// y las acciones sobre la API. Los filtros se aplican al calendario y a la lista.
export function useReservations(homeId: string) {
  const { session } = useRoomie();
  const admin = session.homes.find((h) => h.id === homeId)?.role === "admin";
  const resources = useData<Resource[]>(`/resources?homeId=${homeId}`);
  const upcoming = useData<Reservation[]>(`/reservations?homeId=${homeId}`);
  // ?semana=AAAA-MM-DD (el lunes); sin parámetro, la semana actual. Atrás vuelve a la anterior.
  const [week, setWeek] = useUrlState("semana", "", "push");
  const requested = week ? new Date(`${week}T00:00`) : null;
  const weekStart = startOfWeek(
    requested && !Number.isNaN(requested.getTime()) ? requested : new Date(),
  );
  const weekData = useData<Reservation[]>(
    `/reservations?homeId=${homeId}&from=${encodeURIComponent(weekStart.toISOString())}&to=${encodeURIComponent(addDays(weekStart, 7).toISOString())}`,
  );
  const [resourceFilter, setResourceFilter] = useUrlState("recurso", "all");
  const [mine, setMine] = useUrlState("mias", "no");
  const matches = (r: Reservation) =>
    (resourceFilter === "all" || r.resource_id === resourceFilter) &&
    (mine !== "si" || r.user_id === session.user.id);
  function goToWeek(date: Date) {
    const monday = startOfWeek(date);
    const thisWeek = startOfWeek(new Date());
    setWeek(
      monday.getTime() === thisWeek.getTime()
        ? ""
        : toDateInput(monday.toISOString()).slice(0, 10),
    );
  }
  function reloadReservations() {
    upcoming.reload();
    weekData.reload();
  }
  async function reserve(form: FormData) {
    await api(`/reservations?homeId=${homeId}`, "POST", {
      resource_id: form.get("resource_id"),
      starts_at: fromDateInput(form.get("starts_at")),
      ends_at: fromDateInput(form.get("ends_at")),
    });
    reloadReservations();
  }
  async function cancel(id: string) {
    await api(`/reservations/${id}`, "DELETE");
    reloadReservations();
  }
  async function addResource(form: FormData) {
    await api(`/resources?homeId=${homeId}`, "POST", Object.fromEntries(form));
    resources.reload();
  }
  async function updateResource(id: string, form: FormData) {
    await api(`/resources/${id}`, "PATCH", Object.fromEntries(form));
    resources.reload();
    reloadReservations();
  }
  async function retireResource(id: string) {
    await api(`/resources/${id}`, "DELETE");
    resources.reload();
  }
  return {
    admin,
    resources,
    upcoming: { ...upcoming, visible: (upcoming.data ?? []).filter(matches) },
    week: {
      start: weekStart,
      reservations: weekData.data?.filter(matches) ?? null,
      error: weekData.error,
      reload: weekData.reload,
      goTo: goToWeek,
    },
    filters: {
      resource: resourceFilter,
      setResource: setResourceFilter,
      onlyMine: mine === "si",
      setOnlyMine: (value: boolean) => setMine(value ? "si" : "no"),
    },
    reserve,
    cancel,
    addResource,
    updateResource,
    retireResource,
  };
}
