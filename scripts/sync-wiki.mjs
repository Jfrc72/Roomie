import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";

const directory = process.argv[2];
if (!directory) throw Error("Indica la carpeta del repositorio de la wiki.");
const target = resolve(directory);
mkdirSync(target, { recursive: true });
const repo = "https://github.com/Jfrc72/Roomie";
const pages = {
  "HISTORIAS.md": "Historias-de-usuario",
  "DISENO.md": "Diseno",
  "PRUEBAS.md": "Pruebas",
  "API.md": "API",
  "MODELO.md": "Base-de-datos",
  "DESPLIEGUE.md": "Despliegue",
  "EQUIPO.md": "Trabajo-en-equipo",
  "REVISION-CICLO-1.md": "Correcciones-ciclo-1",
};
for (const [source, name] of Object.entries(pages)) {
  const text = readFileSync(join("docs", source), "utf8")
    .replace(/\]\(\.\.\/(tests|src)\/([^\)]+)\)/g, `](${repo}/blob/main/$1/$2)`)
    .replace(/\]\(([A-Z-]+\.md)\)/g, (_, file) => `](${repo}/wiki/${pages[file] || file})`);
  writeFileSync(join(target, name + ".md"), text);
}
const items = Object.values(pages).map((name) => `- [${name.replaceAll("-", " ")}](${repo}/wiki/${name})`).join("\n");
writeFileSync(join(target, "Home.md"), `# Roomie\n\nOrganizamos la convivencia en un apartamento: tareas, gastos, compras, reservas, mantenimiento, votaciones y acuerdos.\n\nEl listado revisado tiene **10 funcionalidades y 39 historias**. Cada historia incluye responsable, prioridad, estimación, estado, criterios, pruebas y mockups de escritorio y móvil.\n\n${items}\n\nLa instalación está en el [README](${repo}#readme) y los resultados automáticos en [Actions](${repo}/actions/workflows/pruebas.yml).\n`);
console.log(`Wiki preparada: Home y ${Object.keys(pages).length} páginas.`);
