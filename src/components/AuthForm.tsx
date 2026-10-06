"use client";
import { LanguageSelector, useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { type FormEvent } from "react";
import { House, Check, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { useFormAction } from "@/lib/use-form-action";
import { useRoomieNavigation } from "@/lib/use-roomie-navigation";
export default function AuthForm({ register = false }: { register?: boolean }) {
  const { t } = useLanguage();
  const { error, busy, run } = useFormAction();
  const navigation = useRoomieNavigation();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    await run(async () => {
      await api(
        `/auth/${register ? "register" : "login"}`,
        "POST",
        Object.fromEntries(data),
      );
      navigation.goAfterLogin();
    });
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Link className="brand" href="/login">
          <span className="brand-icon">
            <House size={20} />
          </span>
          roomie.
        </Link>
        <div className="story-content">
          <p className="eyebrow">{t("COMPARTIR CASA. SENTIRSE EN CASA.")}</p>
          <h2>
            {t("La convivencia")}
            <br />
            {t("empieza con")}
            <br />
            <em>{t("un buen equipo.")}</em>
          </h2>
          <p>
            {t("Un solo lugar para organizar tu hogar,")}
            <br />
            {t("hacer acuerdos y compartir responsabilidades.")}
          </p>
          <div className="story-points">
            <span>
              <Check size={17} />
              {t("Todos en la misma página")}
            </span>
            <span>
              <Check size={17} />
              {t("Más orden, menos pendientes")}
            </span>
            <span>
              <Check size={17} />
              {t("Un espacio para cada roommate")}
            </span>
          </div>
        </div>
        <small>{t("Tu hogar, un poco más simple.")}</small>
        <div className="house-art" aria-hidden="true">
          <House size={190} strokeWidth={0.8} />
        </div>
      </section>
      <section className="auth-form-area">
        <div className="auth-box">
          <LanguageSelector />
          <span className="tag">{t("BIENVENIDO A ROOMIE")}</span>
          <h1>
            {t(
              register
                ? "Haz espacio para tu hogar"
                : "Qué bueno verte de nuevo",
            )}
          </h1>
          <p>
            {t(
              register
                ? "Crea tu cuenta para organizar la vida en equipo."
                : "Entra y descubre qué está pasando en tu apartamento.",
            )}
          </p>
          <form className="form" onSubmit={submit} aria-busy={busy}>
            <fieldset disabled={busy}>
              {register && (
                <label>
                  {t("Tu nombre")}
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={80}
                    placeholder={t("¿Cómo te llamas?")}
                  />
                </label>
              )}
              <label>
                {t("Correo electrónico")}
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder={t("nombre@correo.com")}
                />
              </label>
              <label>
                {t("Contraseña")}
                <input
                  name="password"
                  type="password"
                  required
                  minLength={register ? 10 : 1}
                  maxLength={128}
                  autoComplete={register ? "new-password" : "current-password"}
                  placeholder={t(
                    register ? "Al menos 10 caracteres" : "Tu contraseña",
                  )}
                />
              </label>
            </fieldset>
            {error && (
              <p className="error" role="alert">
                {t(error)}
              </p>
            )}
            <button disabled={busy}>
              {t(
                busy
                  ? "Un momento…"
                  : register
                    ? "Crear mi cuenta"
                    : "Entrar a mi hogar",
              )}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="auth-switch">
            {t(register ? "¿Ya tienes cuenta?" : "¿Es tu primera vez?")}{" "}
            <Link
              href={register ? "/login" : "/registro"}
              onClick={(e) => {
                const next = new URLSearchParams(window.location.search).get(
                  "next",
                );
                if (next) {
                  e.preventDefault();
                  navigation.switchAuth(!register);
                }
              }}
            >
              {t(register ? "Inicia sesión" : "Crea una cuenta")}
            </Link>
          </p>
          <p className="auth-note">
            {t("Organización para hogares de hasta 8 integrantes.")}
          </p>
        </div>
      </section>
    </main>
  );
}
