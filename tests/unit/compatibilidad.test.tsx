import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/context/LanguageContext";
import { RoomieProvider } from "@/context/RoomieContext";
import { ConfirmButton } from "@/components/ui";
import { api } from "@/lib/api";
import { translate } from "@/lib/i18n";
import { assistantReply } from "@/lib/assistant";

vi.mock("@/lib/api", () => ({ api: vi.fn() }));
beforeEach(() => {
  vi.mocked(api).mockResolvedValue({
    user: { id: "u1", name: "Juan", email: "juan@example.com" },
    homes: [],
    activeHomeId: null,
  });
});
function show(onConfirm: () => Promise<void>, undo: () => Promise<void>) {
  render(
    <LanguageProvider initialLanguage="en">
      <RoomieProvider>
        <ConfirmButton
          label="Delete"
          description="Delete the item?"
          onConfirm={onConfirm}
          success="Producto eliminado."
          undo={undo}
        />
      </RoomieProvider>
    </LanguageProvider>,
  );
}
describe("Confirmación compartida con los módulos del equipo", () => {
  it("conserva el foco y permite deshacer la eliminación en inglés", async () => {
    const user = userEvent.setup();
    const remove = vi.fn().mockResolvedValue(undefined);
    const undo = vi.fn().mockResolvedValue(undefined);
    show(remove, undo);
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Delete" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(remove).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Item deleted.");
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Action undone.");
  });
  it("muestra el error si restaurar falla", async () => {
    const user = userEvent.setup();
    show(
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockRejectedValue(new Error("Producto eliminado no encontrado.")),
    );
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Deleted item not found.",
    );
  });
  it("impide restaurar dos veces mientras la petición está pendiente", async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    const undo = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    show(vi.fn().mockResolvedValue(undefined), undo);
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await user.dblClick(screen.getByRole("button", { name: "Undo" }));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Processing…" })).toBeDisabled();
    finish();
    await screen.findByText("Action undone.");
  });
});
describe("Traducción de mensajes guardados por los módulos", () => {
  it("conserva texto libre que coincide con nombres de propiedades de JavaScript", () => {
    expect(translate("constructor", "en")).toBe("constructor");
    expect(translate("Sala {constructor}", "en")).toBe("Sala {constructor}");
  });
  it("conserva el título de una tarea y el nombre de quien la asignó", () => {
    expect(translate('Tomás te asignó "Lavar la loza".', "en")).toBe(
      'Tomás assigned "Lavar la loza" to you.',
    );
  });
  it("traduce resultados sin cambiar las opciones escritas por el hogar", () => {
    expect(
      translate('"Color de sala": ganó "Verde" por unanimidad.', "en"),
    ).toBe('"Color de sala": "Verde" won unanimously.');
  });
  it("conserva llaves y signos en los datos de una persona", () => {
    expect(translate('Recuerda tu reserva de "Sala {norte} (2)".', "en")).toBe(
      'Remember your reservation for "Sala {norte} (2)".',
    );
  });
});
describe("HU9.5 · Asistente en inglés", () => {
  it("reparte las tareas entre el número de personas pedido en inglés", () => {
    const reply = assistantReply(
      "We are six people and nobody does the tasks",
      "",
      [],
      "en",
    );
    expect(reply.text).toMatch(/^For 6 people/);
    expect(reply.clauses[0]).toContain("Week 1:");
    expect(reply.clauses[0]).toContain("rests");
    expect(reply.clauses[0]).not.toContain("Semana");
  });
  it("mantiene los nombres reales al distribuir tareas", () => {
    const reply = assistantReply(
      "Share the chores fairly",
      "",
      ["Ana", "Tomás", "Juan"],
      "en",
    );
    expect(reply.text).toMatch(/^For 3 people/);
    expect(reply.clauses[0]).toContain("Tomás:");
    expect(reply.clauses[0]).toContain("kitchen");
  });
  it("propone acuerdos de visitas cuando la petición está en inglés", () => {
    const reply = assistantReply("Rules for guests", "", [], "en");
    expect(reply.text).toContain("agreements about guests");
    expect(reply.clauses[0]).toContain("overnight guests");
  });
});
