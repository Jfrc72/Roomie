"use client";
import { useLanguage } from "@/context/LanguageContext";
import { useState } from "react";
import { askAssistant, type AssistantReply } from "@/lib/assistant";

// Conversación con el asistente de IA simulada. Cada turno queda "cargando" (reply null)
// hasta que llega la respuesta; mientras tanto no se aceptan otras preguntas.
export function useRuleAssistant(draft: string, members: string[]) {
  const { language } = useLanguage();
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
    const reply = await askAssistant(question, draft, members, language);
    setTurns((t) =>
      t.map((turn, i) => (i === t.length - 1 ? { ...turn, reply } : turn)),
    );
  }
  return { prompt, setPrompt, turns, loading, ask };
}
