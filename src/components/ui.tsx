"use client";
import { useLanguage } from "@/context/LanguageContext";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { useRoomie } from "@/context/RoomieContext";
import { useFormAction } from "@/lib/use-form-action";
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-symbol" aria-hidden="true">
        ⌂
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function LoadingError({
  error,
  retry,
}: {
  error: string;
  retry: () => void;
}) {
  const { t } = useLanguage();
  return error ? (
    <div className="panel empty">
      <p role="alert">{t(error)}</p>
      <button className="secondary" onClick={retry}>
        {t("Reintentar")}
      </button>
    </div>
  ) : (
    <p className="panel" role="status">
      {t("Cargando información…")}
    </p>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Form({
  children,
  onSave,
  label = "Guardar cambios",
  success = "Cambios guardados.",
}: {
  children: ReactNode;
  onSave: (data: FormData) => Promise<void>;
  label?: string;
  success?: string;
}) {
  const { t } = useLanguage();
  const { busy, error, run } = useFormAction();
  const { toast } = useRoomie();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    if (await run(() => onSave(data))) toast(success);
  }
  return (
    <form onSubmit={submit} className="form" aria-busy={busy}>
      <fieldset disabled={busy}>{children}</fieldset>
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
      <button type="submit" disabled={busy}>
        {t(busy ? "Guardando…" : label)}
      </button>
    </form>
  );
}
export function ConfirmButton({
  label,
  description,
  onConfirm,
  success = "Cambio realizado.",
  undo,
}: {
  label: string;
  description: string;
  onConfirm: () => Promise<void>;
  success?: string;
  undo?: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const { busy, error, run, clearError } = useFormAction();
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) cancel.current?.focus();
    else if (wasOpen.current) trigger.current?.focus();
    wasOpen.current = open;
  }, [open]);
  const { toast } = useRoomie();
  async function confirm() {
    if (await run(onConfirm)) {
      setOpen(false);
      toast(success, undo ? { label: "Deshacer", onClick: undo } : undefined);
    }
  }
  return (
    <div>
      {!open ? (
        <button
          type="button"
          ref={trigger}
          className="text-button danger"
          onClick={() => setOpen(true)}
        >
          {label}
        </button>
      ) : (
        <div
          className="confirmation"
          role="group"
          aria-label={description}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !busy) {
              setOpen(false);
              clearError();
            }
          }}
        >
          <p>{description}</p>
          {error && (
            <p className="error" role="alert">
              {t(error)}
            </p>
          )}
          <div className="actions">
            <button type="button" disabled={busy} onClick={confirm}>
              {t(busy ? "Procesando…" : "Confirmar")}
            </button>
            <button
              className="secondary"
              type="button"
              ref={cancel}
              disabled={busy}
              onClick={() => {
                setOpen(false);
                clearError();
              }}
            >
              {t("Cancelar")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
