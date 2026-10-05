"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { Session } from "@/types";
import { api } from "@/lib/api";
interface RoomieState {
  session: Session;
  refresh: () => Promise<void>;
  selectHome: (id: string) => Promise<void>;
  toast: (message: string, action?: ToastAction) => void;
}
interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
}
const Context = createContext<RoomieState | null>(null);
export function RoomieProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [toastAction, setToastAction] = useState<ToastAction | null>(null);
  const toast = useCallback((nextMessage: string, action?: ToastAction) => {
    setMessage(nextMessage);
    setToastAction(action ?? null);
  }, []);
  const refresh = useCallback(async () => {
    const result = await api<Session>("/session");
    setSession(result);
    setError("");
  }, []);
  useEffect(() => {
    let active = true;
    api<Session>("/session")
      .then((result) => {
        if (active) setSession(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      setMessage("");
      setToastAction(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [message, toastAction]);
  async function selectHome(id: string) {
    await api(`/homes/${id}/select`, "POST", {});
    await refresh();
  }
  if (error)
    return (
      <main className="standalone">
        <h1>No pudimos abrir tu hogar</h1>
        <p role="alert">{error}</p>
        <button onClick={() => refresh().catch((e) => setError(e.message))}>
          Reintentar
        </button>
        <a href="/login">Iniciar sesión</a>
      </main>
    );
  if (!session)
    return (
      <p className="standalone" role="status">
        Cargando tu hogar…
      </p>
    );
  return (
    <Context.Provider
      value={{ session, refresh, selectHome, toast }}
    >
      {children}
      <div className="toast" role="status" aria-live="polite">
        {message && <span>{message}</span>}
        {message && toastAction && (
          <button
            className="secondary"
            type="button"
            onClick={() => {
              const action = toastAction;
              setToastAction(null);
              void Promise.resolve(action.onClick())
                .then(() => setMessage("Acción deshecha."))
                .catch((reason: unknown) =>
                  setMessage(reason instanceof Error ? reason.message : "No se pudo deshacer la acción."),
                );
            }}
          >
            {toastAction.label}
          </button>
        )}
      </div>
    </Context.Provider>
  );
}
export function useRoomie() {
  const value = useContext(Context);
  if (!value) throw Error("Falta RoomieProvider");
  return value;
}
