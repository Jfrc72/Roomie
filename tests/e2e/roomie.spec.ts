import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const ids: string[] = [];
const emails: string[] = [];
const password = "PruebaRoomie2026!";
function email() {
  const value = `e2e-${randomUUID()}@roomie.test`;
  emails.push(value);
  return value;
}
async function rememberAccount(page: Page) {
  const response = await page.request.get("/api/session");
  const { data } = await response.json();
  ids.push(data.user.id);
}
async function register(page: Page) {
  const response = await page.request.post("/api/auth/register", {
    headers: { Origin: process.env.APP_URL || "http://localhost:3000" },
    data: { name: "Prueba navegador", email: email(), password },
  });
  expect(response.ok()).toBeTruthy();
  await rememberAccount(page);
}
async function accessibility(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
}
async function createHome(page: Page) {
  await page.goto("/apartamento");
  await page.getByLabel("Nombre del apartamento").fill("Casa de prueba");
  await page.getByLabel("Dirección", { exact: true }).fill("Bogotá");
  await page
    .getByRole("button", { name: "Crear apartamento", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Información del hogar" }),
  ).toBeVisible();
}
test.afterEach(async () => {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const homes = await db.query(
      "SELECT DISTINCT home_id FROM memberships WHERE user_id=ANY($1::uuid[])",
      [ids],
    );
    for (const { home_id } of homes.rows) {
      await db.query(
        "DELETE FROM deliveries WHERE notification_id IN (SELECT id FROM notifications WHERE home_id=$1)",
        [home_id],
      );
      for (const table of [
        "rule_reports",
        "rule_versions",
        "polls",
        "reservations",
        "resources",
        "tasks",
        "expenses",
        "direct_payments",
        "shopping_items",
        "maintenance_reports",
        "notifications",
        "reminders",
        "activities",
        "invitations",
      ])
        await db.query(`DELETE FROM ${table} WHERE home_id=$1`, [home_id]);
      await db.query(
        "UPDATE sessions SET active_home_id=null WHERE active_home_id=$1",
        [home_id],
      );
      await db.query("DELETE FROM memberships WHERE home_id=$1", [home_id]);
      await db.query("DELETE FROM homes WHERE id=$1", [home_id]);
    }
    await db.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [ids]);
    await db.query("DELETE FROM login_attempts WHERE email=ANY($1::text[])", [
      emails,
    ]);
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
    ids.length = 0;
    emails.length = 0;
  }
});
test.afterAll(async () => pool.end());

test("registro, hogar, perfil, preferencias, archivo y cierre de cuenta", async ({
  page,
}) => {
  await page.goto("/registro");
  await accessibility(page);
  await page.getByLabel("Tu nombre").fill("Prueba navegador");
  await page.getByLabel("Correo electrónico").fill(email());
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(
    page.getByRole("heading", { name: "Un nuevo hogar, un buen comienzo." }),
  ).toBeVisible();
  await rememberAccount(page);
  await createHome(page);
  await accessibility(page);
  await page.getByLabel("Nombre del apartamento").fill("Casa editada");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(
    page.getByRole("combobox", { name: "Apartamento activo" }),
  ).toContainText("Casa editada");
  await page.goto("/perfil");
  await accessibility(page);
  await page.getByLabel("Nombre", { exact: true }).fill("Nombre cambiado");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("status")).toContainText("Cambios guardados.");
  await page.goto("/notificaciones");
  await page.getByLabel("Recordarme antes de un vencimiento").selectOption("6");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await page.reload();
  await expect(
    page.getByLabel("Recordarme antes de un vencimiento"),
  ).toHaveValue("6");
  await accessibility(page);
  await page.goto("/apartamento");
  await page
    .getByRole("button", { name: "Archivar apartamento", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Cancelar", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Archivar apartamento", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Archivar apartamento", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Un espacio para compartir" }),
  ).toBeVisible();
  await page.goto("/perfil");
  await page.getByLabel("Confirma tu contraseña").fill(password);
  await page.getByLabel("Confirmo que quiero cerrar mi cuenta.").check();
  await page
    .getByRole("button", { name: "Cerrar mi cuenta", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
});

test("inglés persiste al recargar y los errores del servidor se traducen", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("combobox", { name: "Idioma" }).selectOption("en");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { name: "Good to see you again" }),
  ).toBeVisible();
  await page.getByLabel("Email address").fill(email());
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in to my home" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Incorrect email or password." }),
  ).toContainText("Incorrect email or password.");
  await accessibility(page);
});

test("navegación móvil sin desbordamiento y enlace de salto por teclado", async ({
  page,
}) => {
  await register(page);
  await createHome(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /¡Hola/ })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Saltar al contenido" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#contenido")).toBeFocused();
  await page.setViewportSize({ width: 320, height: 812 });
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("link", { name: "Mi apartamento", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Mi apartamento", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await accessibility(page);
});

test("módulos en inglés, escritorio, tablet, móvil y deshacer", async ({
  page,
}) => {
  test.setTimeout(180000);
  await register(page);
  await createHome(page);
  const session = (await (await page.request.get("/api/session")).json()).data;
  const homeId = session.activeHomeId;
  const origin = process.env.APP_URL || "http://localhost:3000";
  async function create(path: string, data: unknown) {
    const response = await page.request.post(`/api${path}?homeId=${homeId}`, {
      headers: { Origin: origin },
      data,
    });
    expect(response.ok()).toBeTruthy();
    return (await response.json()).data;
  }
  await create("/expenses", {
    title: "Factura de agua",
    category: "Servicios",
    total_amount: 20000.25,
    expense_date: new Date().toISOString().slice(0, 10),
    paid_by_id: session.user.id,
    participant_ids: [session.user.id],
  });
  await create("/maintenance", {
    title: "Fuga de la cocina",
    description: "Revisar tubería",
    category: "Plomería",
    estimated_cost: 15000,
    priority: "ALTA",
    assigned_membership_id: null,
  });
  await create("/tasks", {
    title: "Lavar la loza",
    description: "Después de cenar",
    assigned_membership_id: null,
    due_at: null,
    priority: "medium",
  });
  const resource = await create("/resources", {
    name: "Lavadora",
    description: "Zona común",
  });
  const start = Date.now() + 86400000;
  await create("/reservations", {
    resource_id: resource.id,
    starts_at: new Date(start).toISOString(),
    ends_at: new Date(start + 3600000).toISOString(),
  });
  await create("/polls", {
    title: "Color de la sala",
    description: "Elegir un color",
    options: ["Azul", "Verde"],
    rule: "unanimous",
    anonymous: false,
    closes_at: null,
  });
  await create("/rules", {
    content:
      "Lavar lo que usemos en la cocina.\n\nCuidar el silencio después de las diez.",
    notes: "",
  });
  await page.getByRole("combobox", { name: "Idioma" }).selectOption("en");
  await page.goto("/compras");
  await page.getByLabel("Item name").fill("Papel higiénico");
  await page.getByLabel("Category").selectOption({ label: "Cleaning" });
  await page.getByRole("button", { name: "Add to list", exact: true }).click();
  await expect(
    page.getByText("Papel higiénico", { exact: true }),
  ).toBeVisible();
  const shopping = (
    await (await page.request.get(`/api/shopping?homeId=${homeId}`)).json()
  ).data;
  expect(shopping[0].category).toBe("Limpieza");
  await page.setViewportSize({ width: 320, height: 812 });
  const routes = [
    ["gastos", "Expenses and payments"],
    ["compras", "Shopping list"],
    ["mantenimiento", "Maintenance and repairs"],
    ["tareas", "Tasks"],
    ["reservas", "Reservations"],
    ["votaciones", "Polls"],
    ["reglamento", "Home agreements"],
  ];
  for (const width of [1280, 768, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [route, title] of routes) {
      await page.goto(`/${route}`);
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Loading information…", { exact: true }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBeTruthy();
      await accessibility(page);
      if (route === "gastos") {
        const amountsFit = await page
          .locator(".stat-card > strong")
          .evaluateAll((elements) =>
            elements.every(
              (element) =>
                element.getBoundingClientRect().height <=
                parseFloat(getComputedStyle(element).lineHeight) + 1,
            ),
          );
        expect(
          amountsFit,
          `Los importes deben verse completos a ${width}px`,
        ).toBeTruthy();
        await test.info().attach(`Gastos a ${width}px`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: "image/png",
        });
      }
    }
  }
  for (const [route, label, title] of [
    ["gastos", "Delete expense", "Factura de agua"],
    ["compras", "Delete", "Papel higiénico"],
    ["mantenimiento", "Delete", "Fuga de la cocina"],
  ]) {
    await page.goto(`/${route}`);
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeFocused();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(page.getByText(title, { exact: true })).not.toBeVisible();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await expect(page.locator(".toast")).toContainText("Action undone.");
  }
});

test("gastos y mantenimiento: formularios, filtros en URL y recarga", async ({
  page,
}) => {
  await register(page);
  await createHome(page);
  await page.goto("/gastos");
  await page.getByLabel("Concepto", { exact: true }).fill("Cuenta de internet");
  await page.getByLabel("Monto total (COP)", { exact: true }).fill("45000.25");
  await page
    .getByRole("combobox", { name: "Categoría", exact: true })
    .selectOption("Servicios");
  await page.getByLabel("Fecha", { exact: true }).fill("2026-01-01");
  await page
    .getByRole("button", { name: "Guardar gasto", exact: true })
    .click();
  await expect(
    page.getByText("Cuenta de internet", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Filtrar por categoría").selectOption("Varios");
  await expect(page).toHaveURL(/categoria=Varios/);
  await expect(
    page.getByText("No hay resultados", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Filtrar por categoría")).toHaveValue("Varios");
  await page.getByLabel("Filtrar por categoría").selectOption("Servicios");
  await page.getByRole("combobox", { name: "Idioma" }).selectOption("en");
  const expense = page
    .locator("article")
    .filter({ has: page.getByText("Cuenta de internet", { exact: true }) });
  await expect(expense).toContainText("45,000.25");
  await expect(expense).toContainText("Jan 1, 2026");
  await expect(expense).toContainText("Paid");
  await page.getByRole("combobox", { name: "Language" }).selectOption("es");

  await page.goto("/mantenimiento");
  await page
    .getByLabel("¿Qué necesita reparación?")
    .fill("Fuga en el lavamanos");
  const form = page.locator("form");
  await form
    .getByRole("combobox", { name: "Categoría", exact: true })
    .selectOption("Plomería");
  await form
    .getByRole("combobox", { name: "Prioridad", exact: true })
    .selectOption("ALTA");
  await page
    .getByRole("button", { name: "Enviar reporte", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Fuga en el lavamanos" }),
  ).toBeVisible();
  await page
    .locator(".module-filters")
    .getByRole("combobox", { name: "Estado", exact: true })
    .selectOption("RESUELTO");
  await expect(page).toHaveURL(/estado=RESUELTO/);
  await expect(
    page.getByText("No hay reportes que coincidan con estos filtros."),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .locator(".module-filters")
      .getByRole("combobox", { name: "Estado", exact: true }),
  ).toHaveValue("RESUELTO");
  await page
    .locator(".module-filters")
    .getByRole("combobox", { name: "Estado", exact: true })
    .selectOption("");
  await page
    .getByLabel("Estado de Fuga en el lavamanos", { exact: true })
    .selectOption("EN_PROGRESO");
  await expect(
    page.getByLabel("Estado de Fuga en el lavamanos", { exact: true }),
  ).toHaveValue("EN_PROGRESO");
});

test("reglamento: asistente, publicación, aceptación y nueva versión", async ({
  page,
  browser,
}) => {
  await register(page);
  await createHome(page);
  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await register(memberPage);
  const member = (await (await memberPage.request.get("/api/session")).json())
    .data;
  const owner = (await (await page.request.get("/api/session")).json()).data;
  const headers = { Origin: process.env.APP_URL || "http://localhost:3000" };
  const invitation = await page.request.post(
    `/api/homes/${owner.activeHomeId}/invitations`,
    {
      headers,
      data: { email: member.user.email },
    },
  );
  expect(invitation.ok()).toBeTruthy();
  const invitationData = (await invitation.json()).data;
  const accepted = await memberPage.request.post("/api/invitations", {
    headers,
    data: { token: new URL(invitationData.url).searchParams.get("token") },
  });
  expect(accepted.ok()).toBeTruthy();
  await page.goto("/reglamento");
  await page
    .getByRole("button", { name: "Redactar reglamento", exact: true })
    .click();
  await page
    .getByLabel("Tu petición", { exact: true })
    .fill("Necesitamos acuerdos sobre las visitas");
  await page
    .getByRole("button", { name: "Pedir sugerencias", exact: true })
    .click();
  await expect(
    page.getByText("El asistente está redactando…", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Agregar al borrador", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Texto del reglamento")).not.toHaveValue("");
  await page
    .getByRole("button", { name: "Publicar versión", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Versión 1", exact: true }),
  ).toBeVisible();
  await memberPage.goto("/reglamento");
  await memberPage
    .getByRole("checkbox", { name: "Leí y acepto la versión 1" })
    .check();
  await memberPage
    .getByRole("button", { name: "Aceptar reglamento", exact: true })
    .click();
  await expect(
    memberPage.getByText("Ya aceptaste esta versión.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Nueva versión", exact: true })
    .click();
  await page
    .getByLabel("Texto del reglamento")
    .fill(
      "Avisar antes de recibir visitas.\n\nLavar los platos después de cocinar.",
    );
  await page.getByLabel("Qué cambió").fill("Acuerdo de cocina");
  await page
    .getByRole("button", { name: "Publicar versión", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Versión 2", exact: true }),
  ).toBeVisible();
  await memberPage.reload();
  await expect(
    memberPage.getByRole("checkbox", { name: "Leí y acepto la versión 2" }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("heading", { name: "Versiones anteriores", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Qué pasó", { exact: true })
    .fill("No se avisó sobre la visita.");
  await page
    .getByRole("button", { name: "Enviar reporte", exact: true })
    .click();
  await expect(
    page.getByText("No se avisó sobre la visita.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Marcar resuelto", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Marcar resuelto", exact: true }),
  ).toHaveCount(0);
  await accessibility(page);
  await memberContext.close();
});

test("reservas: creación, cruce de horarios, calendario y cancelación", async ({
  page,
}) => {
  await register(page);
  await createHome(page);
  await page.goto("/reservas");
  await page.getByLabel("Nombre", { exact: true }).fill("Sala de estudio");
  await page.getByLabel("Descripción", { exact: true }).fill("Segundo piso");
  await page
    .getByRole("button", { name: "Agregar recurso", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Nueva reserva", exact: true })
    .click();
  // Se usan horas locales porque los campos son datetime-local.
  const start = new Date(Date.now() + 86400000);
  start.setHours(14, 0, 0, 0);
  const end = new Date(start.getTime() + 3600000);
  const inputDate = (date: Date) =>
    new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  async function fillReservation() {
    await page.getByLabel("Inicio de la reserva").fill(inputDate(start));
    await page.getByLabel("Fin", { exact: true }).fill(inputDate(end));
    await page.getByRole("button", { name: "Reservar", exact: true }).click();
  }
  await fillReservation();
  await expect(
    page.getByRole("button", { name: "Cancelar reserva", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Nueva reserva", exact: true })
    .click();
  await fillReservation();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    /reservad|cruz|ocupad/i,
  );
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  const initial = page.url();
  await page.getByRole("button", { name: "Semana siguiente" }).click();
  await expect(page).toHaveURL(/semana=/);
  await page.goBack();
  await expect(page).toHaveURL(initial);
  await page.getByRole("checkbox", { name: "Solo mis reservas" }).check();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Solo mis reservas" }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Cancelar reserva", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cancelar reserva", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Todo libre por ahora", { exact: true }),
  ).toBeVisible();
});
