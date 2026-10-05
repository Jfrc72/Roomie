// Asistente de acuerdos con IA simulada (mock). La interfaz se usa como si llamara a un
// modelo: askAssistant recibe la petición y el borrador y responde después de una espera.
// Para conectar una IA real basta con reemplazar esta función por una llamada a la API.
export interface AssistantReply {
  text: string;
  clauses: string[];
}
const topics = [
  {
    title: "limpieza",
    keywords: ["limpi", "aseo", "basura", "loza", "plato", "sucio"],
    clauses: [
      "Cada persona lava lo que usa en la cocina el mismo día.",
      "Las zonas comunes se limpian por turnos semanales, asignados en Tareas.",
      "La basura se saca cuando la caneca esté llena y siempre la noche antes de la recolección.",
    ],
  },
  {
    title: "ruido",
    keywords: ["ruido", "silencio", "volumen", "musica", "descanso", "fiesta"],
    clauses: [
      "Entre las 10:00 p. m. y las 7:00 a. m. se mantiene un volumen bajo en todo el apartamento.",
      "Las reuniones o fiestas se avisan al resto con al menos dos días de anticipación.",
    ],
  },
  {
    title: "visitas",
    keywords: ["visita", "invitad", "pareja", "amig", "huesped"],
    clauses: [
      "Las visitas que se queden a dormir se avisan con al menos un día de anticipación.",
      "Ninguna visita se queda más de tres noches seguidas sin el acuerdo de todos.",
      "Quien recibe una visita responde por el orden y los daños en las zonas comunes.",
    ],
  },
  {
    title: "gastos",
    keywords: [
      "gasto",
      "pago",
      "pagar",
      "plata",
      "dinero",
      "arriendo",
      "factura",
    ],
    clauses: [
      "Los gastos comunes se registran en Gastos el mismo día en que se pagan.",
      "El arriendo y los servicios se pagan a más tardar el día 5 de cada mes.",
    ],
  },
  {
    title: "espacios compartidos",
    keywords: ["reserva", "lavadora", "nevera", "bano", "espacio", "compartid"],
    clauses: [
      "La lavadora, la sala de estudio y los demás recursos se reservan en Reservas.",
      "Cada persona tiene su espacio en la nevera; lo compartido se marca como tal.",
    ],
  },
  {
    title: "mascotas",
    keywords: ["mascota", "perro", "gato", "animal"],
    clauses: [
      "Antes de traer una mascota se necesita el acuerdo de todos los integrantes.",
      "Quien tiene una mascota se encarga de su comida, su aseo y los daños que cause.",
    ],
  },
  {
    title: "seguridad",
    keywords: ["seguridad", "llave", "puerta", "gas", "robo"],
    clauses: [
      "La puerta principal se cierra con llave siempre, también durante el día.",
      "No se entregan copias de las llaves a personas ajenas al apartamento.",
    ],
  },
  {
    title: "cambios al reglamento",
    keywords: ["votac", "decisi", "decid", "modific"],
    clauses: [
      "Los cambios a este reglamento se proponen en Votaciones y se deciden por mayoría simple.",
      "Un administrador publica cada nueva versión y cada integrante la acepta en Acuerdos.",
    ],
  },
  {
    title: "reparto de tareas",
    keywords: ["rotaci", "turno"],
    clauses: [
      "Las tareas del hogar rotan cada semana para que la carga sea pareja entre todos.",
    ],
  },
];
export const assistantExamples = [
  "Somos cuatro y nadie cumple las tareas",
  "Reglas para las visitas",
  "Horarios de silencio",
  "Revisa mi borrador",
];
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const join = (items: string[]) =>
  items.length > 1
    ? `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`
    : items[0];
// Caso del pitch: pedir un reparto equitativo cuando no se cumplen las tareas.
const distributionWords = [
  "tarea",
  "cumpl",
  "repart",
  "rotaci",
  "turno",
  "equitativ",
  "oficio",
];
const numberWords: Record<string, number> = {
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
};
const areas = ["cocina", "baños", "zonas comunes", "basura"];
const peopleWords = ["personas", "roommates", "integrantes", "companeros"];
// "somos cuatro", "5 personas", "vivimos tres"… Solo hogares de 2 a 8 personas.
function peopleIn(text: string) {
  const words = text.split(/[^a-z0-9]+/);
  const count = (word: string) =>
    numberWords[word] ?? (/^\d+$/.test(word) ? Number(word) : 0);
  for (let i = 0; i < words.length - 1; i++) {
    let n = 0;
    if (words[i] === "somos" || words[i] === "vivimos") n = count(words[i + 1]);
    else if (peopleWords.includes(words[i + 1])) n = count(words[i]);
    if (n >= 2 && n <= 8) return n;
  }
  return null;
}
// Rotación semanal: el área j le toca a la persona (j + semana) mod n. En max(n, 4) semanas
// todos pasan por todas las áreas; con más de 4 personas, cada semana alguien descansa.
function distribution(asked: string, members: string[]): AssistantReply {
  const counted = peopleIn(asked);
  const n = counted ?? (members.length >= 2 ? members.length : 4);
  const names =
    members.length === n
      ? members
      : Array.from({ length: n }, (_, i) => `Persona ${i + 1}`);
  const cycle = Math.max(n, areas.length);
  const weeks = Array.from({ length: Math.min(cycle, 4) }, (_, week) => {
    const turns = names.map((name, person) => {
      const mine = areas.filter((_, area) => (area + week) % n === person);
      return `${name}: ${mine.length ? mine.join(" y ") : "descansa"}`;
    });
    return `Semana ${week + 1}: ${turns.join("; ")}.`;
  });
  const notes = [
    counted === null && members.length < 2
      ? "No sé cuántas personas viven contigo, así que usé 4; dímelo y la ajusto."
      : "",
    names[0] === "Persona 1" && counted !== null
      ? "Cambia los nombres por los de tu hogar."
      : "",
  ].filter(Boolean);
  return {
    text: `Para ${n} personas propongo una rotación semanal de ${areas.length} áreas: cada lunes cambian de responsable, así en ${cycle} semanas todos pasan por todas y la carga queda pareja. ${notes.join(" ")}`.trim(),
    clauses: [
      `Rotación semanal de tareas (empieza cada lunes):\n${weeks.join("\n")}${cycle > 4 ? "\nDespués se sigue rotando en el mismo orden." : "\nDespués se repite el ciclo."}`,
      "Cada responsable crea su tarea en Tareas al inicio de la semana y la marca como completada al terminar.",
      "Quien no pueda cumplir su turno lo cambia con otra persona antes del lunes y lo avisa a todos.",
      "Si una tarea queda sin hacer dos semanas seguidas, cualquiera puede reportar el incumplimiento en Acuerdos.",
    ],
  };
}
export async function askAssistant(
  prompt: string,
  draft: string,
  members: string[] = [],
): Promise<AssistantReply> {
  // Simula el tiempo de respuesta de un modelo.
  await new Promise((resolve) =>
    setTimeout(resolve, 900 + Math.random() * 900),
  );
  const asked = normalize(prompt);
  const written = normalize(draft);
  if (distributionWords.some((word) => asked.includes(word)))
    return distribution(asked, members);
  const requested = topics.filter((t) =>
    t.keywords.some((k) => asked.includes(k)),
  );
  if (requested.length)
    return {
      text: `Te propongo estos acuerdos sobre ${join(requested.map((t) => t.title))}. Ajústalos a lo que decidan en casa antes de publicarlos.`,
      clauses: requested.flatMap((t) => t.clauses),
    };
  const missing = topics
    .filter((t) => !t.keywords.some((k) => written.includes(k)))
    .slice(0, 3);
  const intro = /revis|borrador/.test(asked)
    ? "Revisé tu borrador."
    : "No identifiqué un tema concreto en tu mensaje, así que revisé tu borrador.";
  if (!missing.length)
    return {
      text: `${intro} Ya cubre los temas habituales de convivencia. Verifica que cada acuerdo sea claro y fácil de cumplir.`,
      clauses: [],
    };
  return {
    text: `${intro} Todavía no habla de ${join(missing.map((t) => t.title))}. Estas cláusulas pueden servir de punto de partida:`,
    clauses: missing.map((t) => t.clauses[0]),
  };
}
