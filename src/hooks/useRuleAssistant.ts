"use client";
import { useLanguage } from "@/context/LanguageContext";
import { useState } from "react";
import { api } from "@/lib/api";
import { useData } from "@/lib/use-data";
import { askAssistant, type AssistantReply } from "@/lib/assistant";

export type AssistantMode = "ai" | "simulated";
interface AssistantStatus {
  mode: AssistantMode;
  model: string | null;
}
export interface AssistantTurn {
  prompt: string;
  reply: AssistantReply | null;
  error?: string;
}

// Conversación con el asistente de acuerdos. Si el servidor tiene configurada la IA
// (ANTHROPIC_API_KEY), cada pregunta va a NestJS y de ahí a Claude; si no, responde el
// asistente simulado del navegador. Cada turno queda "cargando" hasta que llega la respuesta
// o un error, y mientras tanto no se aceptan otras preguntas.
export function useRuleAssistant(
  homeId: string,
  draft: string,
  members: string[],
) {
  const { language } = useLanguage();
  const status = useData<AssistantStatus>(`/rules/assistant?homeId=${homeId}`);
  // Si no se pudo consultar el estado, se usa el asistente simulado.
  const mode: AssistantMode | null = status.loading
    ? null
    : (status.data?.mode ?? "simulated");
  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const last = turns.at(-1);
  const loading = !!last && !last.reply && !last.error;
  async function reply(question: string) {
    if (mode !== "ai") return askAssistant(question, draft, members, language);
    return api<AssistantReply>(`/rules/assistant?homeId=${homeId}`, "POST", {
      prompt: question,
      draft,
      language,
    });
  }
  async function ask(text: string) {
    const question = text.trim();
    if (!question || loading || !mode) return;
    setPrompt("");
    setTurns((t) => [...t, { prompt: question, reply: null }]);
    let result: Omit<AssistantTurn, "prompt">;
    try {
      result = { reply: await reply(question) };
    } catch (e) {
      result = { reply: null, error: (e as Error).message };
    }
    setTurns((t) =>
      t.map((turn, i) => (i === t.length - 1 ? { ...turn, ...result } : turn)),
    );
  }
  return {
    prompt,
    setPrompt,
    turns,
    loading,
    ask,
    mode,
    model: status.data?.model ?? null,
  };
}
