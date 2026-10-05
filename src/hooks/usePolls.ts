"use client";
import { api } from "@/lib/api";
import { fromDateInput } from "@/lib/dates";
import { useData } from "@/lib/use-data";
import type { Poll } from "@/types";

// Votaciones del hogar separadas en abiertas y cerradas, y las acciones de crear, votar y cerrar.
export function usePolls(homeId: string) {
  const { data, error, reload } = useData<Poll[]>(`/polls?homeId=${homeId}`);
  async function createPoll(form: FormData) {
    await api(`/polls?homeId=${homeId}`, "POST", {
      title: form.get("title"),
      description: form.get("description"),
      rule: form.get("rule"),
      anonymous: form.get("anonymous") === "on",
      closes_at: fromDateInput(form.get("closes_at")),
      // Una opción por línea; se ignoran las líneas vacías.
      options: String(form.get("options"))
        .split("\n")
        .map((o) => o.trim())
        .filter(Boolean),
    });
    reload();
  }
  async function vote(pollId: string, form: FormData) {
    await api(`/polls/${pollId}/votes`, "POST", {
      option_id: form.get("option_id"),
    });
    reload();
  }
  async function closePoll(pollId: string) {
    await api(`/polls/${pollId}/close`, "POST", {});
    reload();
  }
  return {
    polls: data,
    groups: data && {
      open: data.filter((p) => p.status === "open"),
      closed: data.filter((p) => p.status === "closed"),
    },
    error,
    reload,
    createPoll,
    vote,
    closePoll,
  };
}
