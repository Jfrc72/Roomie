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

test("módulos del equipo en inglés, categorías estables y deshacer en móvil", async ({
  page,
}) => {
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
