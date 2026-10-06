// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";
import english from "@/locales/en.json";

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sources(path)
      : /\.tsx?$/.test(path)
        ? [path]
        : [];
  });
}
it("cada texto fijo enviado al traductor tiene una versión en inglés", () => {
  const missing = new Set<string>();
  for (const path of sources("src")) {
    const file = ts.createSourceFile(
      path,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node: ts.Node) {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "t"
      ) {
        const text = node.arguments[0];
        if (
          text &&
          ts.isStringLiteral(text) &&
          !Object.hasOwn(english, text.text)
        )
          missing.add(text.text);
      }
      ts.forEachChild(node, visit);
    }
    visit(file);
  }
  expect([...missing]).toEqual([]);
});
it("las traducciones conservan los campos de los mensajes", () => {
  const fields = (text: string) =>
    [...text.matchAll(/\{\w+\}/g)].map((match) => match[0]).sort();
  for (const [original, translated] of Object.entries(english)) {
    expect(fields(translated), original).toEqual(fields(original));
    expect(translated.trim(), original).not.toBe("");
  }
});
