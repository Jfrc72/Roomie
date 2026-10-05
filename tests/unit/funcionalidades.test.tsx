import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { LanguageProvider } from "@/context/LanguageContext";
import AuthForm from "@/components/AuthForm";
import AppShell from "@/components/AppShell";
import Profile from "@/components/Profile";
import HomeManager from "@/components/HomeManager";
import AcceptInvitation from "@/components/AcceptInvitation";
import Notifications from "@/components/Notifications";
import { api } from "@/lib/api";
import { password } from "@/server/validation";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refreshRoute: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
  selectHome: vi.fn(),
  session: {
    user: { id: "u1", name: "Juan", email: "juan@example.com" },
    homes: [] as {
      id: string;
      name: string;
      address: string;
      description: string;
      role: "admin" | "member";
      member_count: number;
    }[],
    activeHomeId: null as string | null,
  },
}));
vi.mock("@/lib/api", () => ({ api: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refreshRoute }),
  usePathname: () => "/",
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("@/context/RoomieContext", () => ({ useRoomie: () => mocks }));

const home = {
  id: "h1",
  name: "Casa 302",
  address: "Bogotá",
  description: "Nuestro hogar",
  role: "admin" as const,
  member_count: 2,
};
const members = [
  {
    id: "u1",
    membership_id: "m1",
    name: "Juan",
    email: "juan@example.com",
    role: "admin",
  },
  {
    id: "u2",
    membership_id: "m2",
    name: "Miguel",
    email: "miguel@example.com",
    role: "member",
  },
];
const notices = [
  {
    id: "n1",
    title: "Tu rol cambió",
    message: "Tu nuevo rol es administrador.",
    href: "/apartamento",
    read_at: null,
    created_at: "2026-10-01T12:00:00Z",
  },
  {
    id: "n2",
    title: "Un nuevo roommate",
    message: "Otra novedad",
    href: "/apartamento",
    read_at: "2026-10-01T12:00:00Z",
    created_at: "2026-10-01T11:00:00Z",
  },
];
function show(component: ReactNode, language: "es" | "en" = "es") {
  return render(
    <LanguageProvider initialLanguage={language}>{component}</LanguageProvider>,
  );
}
async function fillLogin(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByLabelText("Correo electrónico"),
    "juan@example.com",
  );
  await user.type(screen.getByLabelText("Contraseña"), "RoomieClase2026!");
}
async function submitLogin(register = false) {
  const user = userEvent.setup();
  if (register) await user.type(screen.getByLabelText("Tu nombre"), "Juan");
  await fillLogin(user);
  await user.click(
    screen.getByRole("button", {
      name: register ? "Crear mi cuenta" : "Entrar a mi hogar",
    }),
  );
  return user;
}
function activateHome(role: "admin" | "member" = "admin") {
  mocks.session.homes = [{ ...home, role }];
  mocks.session.activeHomeId = home.id;
}
async function homeReady() {
  await screen.findByRole("heading", { name: "Información del hogar" });
}
beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState({}, "", "/");
  mocks.session.user = { id: "u1", name: "Juan", email: "juan@example.com" };
  mocks.session.homes = [];
  mocks.session.activeHomeId = null;
  vi.mocked(api).mockImplementation(async (path, method = "GET") => {
    if (method !== "GET") return {} as never;
    if (path === "/homes/h1") return { ...home, members } as never;
    if (path.endsWith("/invitations"))
      return [
        {
          id: "i1",
          email: "tomas@example.com",
          status: "pending",
          expires_at: "2099-01-01",
        },
      ] as never;
    if (path === "/notifications/preferences")
      return {
        email_enabled: false,
        push_enabled: false,
        reminder_hours: 24,
        emailAvailable: false,
        pushAvailable: false,
      } as never;
    if (path.startsWith("/notifications?")) return notices as never;
    return [] as never;
  });
});

describe("HU10.1 · Registro", () => {
  it("envía nombre, correo y contraseña y abre el hogar", async () => {
    show(<AuthForm register />);
    await submitLogin(true);
    expect(api).toHaveBeenCalledWith("/auth/register", "POST", {
      name: "Juan",
      email: "juan@example.com",
      password: "RoomieClase2026!",
    });
    expect(mocks.push).toHaveBeenCalledWith("/");
  });
  it("rechaza una contraseña corta con la regla del servidor", () => {
    expect(password.safeParse("corta").success).toBe(false);
    expect(password.safeParse("RoomieClase2026!").success).toBe(true);
    show(<AuthForm register />);
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute(
      "minlength",
      "10",
    );
  });
  it("presenta el correo duplicado y permite corregirlo", async () => {
    vi.mocked(api).mockRejectedValueOnce(
      new Error("Ya existe un registro con estos datos."),
    );
    show(<AuthForm register />);
    await submitLogin(true);
    expect(screen.getByRole("alert")).toHaveTextContent("Ya existe");
    expect(
      screen.getByRole("button", { name: "Crear mi cuenta" }),
    ).toBeEnabled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});

describe("HU10.1 / HU10.2 · Sesión", () => {
  it("abre la invitación pendiente después del login", async () => {
    window.history.replaceState(
      {},
      "",
      "/login?next=%2Finvitaciones%3Ftoken%3Dabc",
    );
    show(<AuthForm />);
    await submitLogin();
    expect(mocks.push).toHaveBeenCalledWith("/invitaciones?token=abc");
  });
  it("mantiene el formulario cuando las credenciales no coinciden", async () => {
    vi.mocked(api).mockRejectedValueOnce(
      new Error("Correo o contraseña incorrectos."),
    );
    show(<AuthForm />);
    await submitLogin();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Correo o contraseña incorrectos.",
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it("cierra la sesión desde la barra superior", async () => {
    const user = userEvent.setup();
    show(
      <AppShell>
        <h1>Inicio</h1>
      </AppShell>,
    );
    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    expect(api).toHaveBeenCalledWith("/auth/logout", "POST", {});
    expect(mocks.push).toHaveBeenCalledWith("/login");
  });
});

describe("HU10.3 · Perfil y baja de cuenta", () => {
  it("guarda el nombre y actualiza la sesión visible", async () => {
    const user = userEvent.setup();
    show(<Profile />);
    await user.clear(screen.getByLabelText("Nombre"));
    await user.type(screen.getByLabelText("Nombre"), "Juan Carlos");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(api).toHaveBeenCalledWith("/auth/profile", "PATCH", {
      name: "Juan Carlos",
    });
    expect(mocks.refresh).toHaveBeenCalled();
  });
  it("solicita la contraseña actual al actualizarla", async () => {
    const user = userEvent.setup();
    show(<Profile />);
    await user.type(screen.getByLabelText("Contraseña actual"), "Actual2026!");
    await user.type(
      screen.getByLabelText("Nueva contraseña"),
      "NuevaClave2026!",
    );
    await user.click(
      screen.getByRole("button", { name: "Actualizar contraseña" }),
    );
    expect(api).toHaveBeenCalledWith("/auth/password", "PATCH", {
      current: "Actual2026!",
      password: "NuevaClave2026!",
    });
  });
  it("requiere confirmación antes de cerrar la cuenta", async () => {
    const user = userEvent.setup();
    show(<Profile />);
    await user.type(
      screen.getByLabelText("Confirma tu contraseña"),
      "Actual2026!",
    );
    await user.click(screen.getByRole("button", { name: "Cerrar mi cuenta" }));
    expect(api).not.toHaveBeenCalled();
    await user.click(
      screen.getByLabelText("Confirmo que quiero cerrar mi cuenta."),
    );
    await user.click(screen.getByRole("button", { name: "Cerrar mi cuenta" }));
    expect(api).toHaveBeenCalledWith("/auth/account", "DELETE", {
      current: "Actual2026!",
    });
    expect(mocks.push).toHaveBeenCalledWith("/login");
  });
});

describe("HU1.1 · Apartamentos", () => {
  it("crea un hogar con sus datos y refresca el selector", async () => {
    const user = userEvent.setup();
    show(<HomeManager />);
    await user.type(
      screen.getByLabelText("Nombre del apartamento"),
      "Mi hogar",
    );
    await user.type(screen.getByLabelText("Dirección"), "Bogotá");
    await user.click(screen.getByRole("button", { name: "Crear apartamento" }));
    expect(api).toHaveBeenCalledWith("/homes", "POST", {
      name: "Mi hogar",
      address: "Bogotá",
      description: "",
    });
    expect(mocks.refresh).toHaveBeenCalled();
  });
  it("permite a un administrador guardar la información del hogar", async () => {
    const user = userEvent.setup();
    activateHome();
    show(<HomeManager />);
    await homeReady();
    await user.clear(screen.getByLabelText("Nombre del apartamento"));
    await user.type(
      screen.getByLabelText("Nombre del apartamento"),
      "Casa nueva",
    );
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(api).toHaveBeenCalledWith("/homes/h1", "PATCH", {
      name: "Casa nueva",
      address: "Bogotá",
      description: "Nuestro hogar",
    });
  });
  it("archiva el hogar únicamente al confirmar", async () => {
    const user = userEvent.setup();
    activateHome();
    show(<HomeManager />);
    await homeReady();
    await user.click(
      screen.getByRole("button", { name: "Archivar apartamento" }),
    );
    expect(api).not.toHaveBeenCalledWith("/homes/h1", "DELETE");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(api).toHaveBeenCalledWith("/homes/h1", "DELETE");
    expect(mocks.refresh).toHaveBeenCalled();
  });
});

describe("HU1.3 / HU1.4 · Integrantes y roles", () => {
  it("promueve a un integrante mediante una confirmación", async () => {
    const user = userEvent.setup();
    activateHome();
    show(<HomeManager />);
    await homeReady();
    await user.click(
      screen.getByRole("button", { name: "Hacer administrador" }),
    );
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(api).toHaveBeenCalledWith("/homes/h1/members/m2", "PATCH", {
      role: "admin",
    });
  });
  it("presenta el rechazo al intentar retirar al último administrador", async () => {
    const user = userEvent.setup();
    activateHome();
    vi.mocked(api).mockImplementation(async (path, method = "GET") => {
      if (method === "DELETE")
        throw new Error(
          "Debe quedar al menos un administrador. Asigna otro primero.",
        );
      return path.endsWith("/invitations")
        ? []
        : ({ ...home, members } as never);
    });
    show(<HomeManager />);
    await homeReady();
    const row = screen
      .getByText("Juan", { selector: "strong" })
      .closest(".member-row") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Retirar" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Debe quedar al menos un administrador",
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("muestra los datos sin controles administrativos a un integrante", async () => {
    activateHome("member");
    show(<HomeManager />);
    await homeReady();
    expect(
      screen.getByText("Casa 302", { selector: "dd" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Retirar" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Archivar apartamento" }),
    ).not.toBeInTheDocument();
  });
});

describe("HU1.2 · Invitaciones", () => {
  it("genera un enlace vinculado al correo escrito", async () => {
    const user = userEvent.setup();
    activateHome();
    vi.mocked(api).mockImplementation(async (path, method = "GET") => {
      if (method === "POST")
        return { url: "http://localhost:3000/invitaciones?token=abc" } as never;
      return path.endsWith("/invitations")
        ? []
        : ({ ...home, members } as never);
    });
    show(<HomeManager />);
    await homeReady();
    await user.type(
      screen.getByLabelText("Correo de la persona"),
      "tomas@example.com",
    );
    await user.click(screen.getByRole("button", { name: "Crear invitación" }));
    expect(api).toHaveBeenCalledWith("/homes/h1/invitations", "POST", {
      email: "tomas@example.com",
    });
    expect(await screen.findByLabelText("Enlace para compartir")).toHaveValue(
      "http://localhost:3000/invitaciones?token=abc",
    );
  });
  it("acepta el token y actualiza la sesión del invitado", async () => {
    const user = userEvent.setup();
    show(<AcceptInvitation token="abc" />);
    await user.click(
      screen.getByRole("button", { name: "Aceptar invitación" }),
    );
    expect(api).toHaveBeenCalledWith("/invitations", "POST", { token: "abc" });
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith("/");
  });
  it("cancela una invitación pendiente", async () => {
    const user = userEvent.setup();
    activateHome();
    show(<HomeManager />);
    await user.click(
      await screen.findByRole("button", { name: "Cancelar invitación" }),
    );
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(api).toHaveBeenCalledWith("/homes/h1/invitations/i1", "DELETE");
  });
});

describe("HU7.1 · Bandeja de notificaciones", () => {
  it("consulta únicamente el apartamento activo", async () => {
    activateHome();
    show(<Notifications />);
    await screen.findByRole("heading", { name: "Tu rol cambió" });
    expect(api).toHaveBeenCalledWith("/notifications?homeId=h1");
  });
  it("filtra los avisos leídos con el control de solo sin leer", async () => {
    const user = userEvent.setup();
    activateHome();
    show(<Notifications />);
    await screen.findByRole("heading", { name: "Un nuevo roommate" });
    await user.click(screen.getByLabelText("Solo sin leer"));
    expect(
      screen.queryByRole("heading", { name: "Un nuevo roommate" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Tu rol cambió" }),
    ).toBeInTheDocument();
  });
  it("invita a crear un hogar cuando no hay apartamento", async () => {
    show(<Notifications />);
    expect(
      screen.getByRole("link", { name: "Crear mi apartamento" }),
    ).toHaveAttribute("href", "/apartamento");
  });
});

describe("HU7.1 · Leer y eliminar avisos", () => {
  it("marca un aviso como leído", async () => {
    const user = userEvent.setup();
    activateHome();
    show(<Notifications />);
    await user.click(
      await screen.findByRole("button", { name: "Marcar leída" }),
    );
    expect(api).toHaveBeenCalledWith("/notifications/n1", "PATCH", {
      read: true,
    });
  });
  it("vuelve a marcar un aviso como pendiente", async () => {
    const user = userEvent.setup();
    activateHome();
    show(<Notifications />);
    await user.click(
      await screen.findByRole("button", { name: "Marcar sin leer" }),
    );
    expect(api).toHaveBeenCalledWith("/notifications/n2", "PATCH", {
      read: false,
    });
  });
  it("elimina el aviso elegido después de confirmar", async () => {
    const user = userEvent.setup();
    activateHome();
    show(<Notifications />);
    await screen.findByRole("heading", { name: "Tu rol cambió" });
    const notice = screen
      .getByRole("heading", { name: "Tu rol cambió" })
      .closest("article")!;
    await user.click(
      within(notice).getByRole("button", { name: "Eliminar aviso" }),
    );
    await user.click(within(notice).getByRole("button", { name: "Confirmar" }));
    expect(api).toHaveBeenCalledWith("/notifications/n1", "DELETE");
  });
});

describe("HU7.2 · Preferencias y recordatorios", () => {
  it("guarda la anticipación elegida", async () => {
    const user = userEvent.setup();
    activateHome();
    show(<Notifications />);
    await screen.findByRole("heading", { name: "A tu manera" });
    await user.selectOptions(
      screen.getByLabelText("Recordarme antes de un vencimiento"),
      "6",
    );
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(api).toHaveBeenCalledWith("/notifications/preferences", "PATCH", {
      email_enabled: false,
      push_enabled: false,
      reminder_hours: 6,
    });
  });
  it("mantiene desactivado el correo si el servidor no lo ofrece", async () => {
    show(<Notifications />);
    await screen.findByRole("heading", { name: "A tu manera" });
    expect(screen.getByLabelText("Correo electrónico")).toBeDisabled();
    expect(
      screen.getByText("El envío de correos aún no está habilitado."),
    ).toBeInTheDocument();
  });
  it("mantiene desactivado push si el servidor no está configurado", async () => {
    show(<Notifications />);
    await screen.findByRole("heading", { name: "A tu manera" });
    expect(screen.getByLabelText("Notificaciones push")).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Registrar este dispositivo" }),
    ).not.toBeInTheDocument();
  });
});

it("el selector traduce el formulario y actualiza el idioma del documento", async () => {
  const user = userEvent.setup();
  show(<AuthForm />);
  await user.selectOptions(screen.getByLabelText("Idioma"), "en");
  expect(
    screen.getByRole("button", { name: "Sign in to my home" }),
  ).toBeInTheDocument();
  expect(document.documentElement).toHaveAttribute("lang", "en");
});
it("una confirmación se puede cancelar con Escape y devuelve el foco", async () => {
  const user = userEvent.setup();
  activateHome();
  show(<HomeManager />);
  await homeReady();
  const trigger = screen.getByRole("button", { name: "Archivar apartamento" });
  await user.click(trigger);
  expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(
    screen.getByRole("button", { name: "Archivar apartamento" }),
  ).toHaveFocus();
  expect(api).not.toHaveBeenCalledWith("/homes/h1", "DELETE");
});
