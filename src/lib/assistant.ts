import { translate, type Language } from "./i18n";

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
const englishKeywords: Record<string, string[]> = {
  limpieza: ["clean", "trash", "dish", "dirty"],
  ruido: ["noise", "quiet", "music", "party"],
  visitas: ["guest", "visit"],
  gastos: ["expense", "payment", "rent", "bill"],
  "espacios compartidos": [
    "resource",
    "reservation",
    "washing",
    "shared space",
    "fridge",
  ],
  mascotas: ["pet", "dog", "cat"],
  seguridad: ["security", "key", "door", "theft"],
  "cambios al reglamento": ["poll", "decision", "change rules"],
  "reparto de tareas": ["rotation", "turn"],
};

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
const join = (items: string[], language: Language = "es") =>
  items.length > 1
    ? `${items.slice(0, -1).join(", ")}${language === "en" ? " and " : " y "}${items[items.length - 1]}`
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
  "task",
  "chore",
  "rotat",
  "fair",
  "take turns",
  "distribut",
];
const numberWords: Record<string, number> = {
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
};
const areas = ["cocina", "baños", "zonas comunes", "basura"];
const peopleWords = [
  "personas",
  "roommates",
  "integrantes",
  "companeros",
  "people",
  "members",
  "persons",
];
// "somos cuatro", "5 personas", "vivimos tres"… Solo hogares de 2 a 8 personas.
function peopleIn(text: string) {
  const words = text.split(/[^a-z0-9]+/);
  const count = (word: string) =>
    numberWords[word] ?? (/^\d+$/.test(word) ? Number(word) : 0);
  for (let i = 0; i < words.length - 1; i++) {
    let n = 0;
    if (words[i] === "somos" || words[i] === "vivimos" || words[i] === "are")
      n = count(words[i + 1]);
    else if (peopleWords.includes(words[i + 1])) n = count(words[i]);
    if (n >= 2 && n <= 8) return n;
  }
  return null;
}
// Rotación semanal: el área j le toca a la persona (j + semana) mod n. En max(n, 4) semanas
// todos pasan por todas las áreas; con más de 4 personas, cada semana alguien descansa.
function distribution(
  asked: string,
  members: string[],
  language: Language,
): AssistantReply {
  const t = (message: string, values?: Record<string, string | number>) =>
    translate(message, language, values);
  const counted = peopleIn(asked);
  const n = counted ?? (members.length >= 2 ? members.length : 4);
  const names =
    members.length === n
      ? members
      : Array.from({ length: n }, (_, i) =>
          t("Persona {count}", { count: i + 1 }),
        );
  const cycle = Math.max(n, areas.length);
  const weeks = Array.from({ length: Math.min(cycle, 4) }, (_, week) => {
    const turns = names.map((name, person) => {
      const mine = areas.filter((_, area) => (area + week) % n === person);
      return `${name}: ${mine.length ? mine.map((area) => t(area)).join(language === "en" ? " and " : " y ") : t("descansa")}`;
    });
    return t("Semana {week}: {turns}.", {
      week: week + 1,
      turns: turns.join("; "),
    });
  });
  const notes = [
    counted === null && members.length < 2
      ? t(
          "No sé cuántas personas viven contigo, así que usé 4; dímelo y la ajusto.",
        )
      : "",
    members.length !== n && counted !== null
      ? t("Cambia los nombres por los de tu hogar.")
      : "",
  ].filter(Boolean);
  return {
    text: t(
      "Para {count} personas propongo una rotación semanal de {areas} áreas: cada lunes cambian de responsable, así en {weeks} semanas todos pasan por todas y la carga queda pareja. {notes}",
      { count: n, areas: areas.length, weeks: cycle, notes: notes.join(" ") },
    ).trim(),
    clauses: [
      `${t("Rotación semanal de tareas (empieza cada lunes):")}\n${weeks.join("\n")}\n${t(cycle > 4 ? "Después se sigue rotando en el mismo orden." : "Después se repite el ciclo.")}`,
      t(
        "Cada responsable crea su tarea en Tareas al inicio de la semana y la marca como completada al terminar.",
      ),
      t(
        "Quien no pueda cumplir su turno lo cambia con otra persona antes del lunes y lo avisa a todos.",
      ),
      t(
        "Si una tarea queda sin hacer dos semanas seguidas, cualquiera puede reportar el incumplimiento en Acuerdos.",
      ),
    ],
  };
}
// Punto de conexión: la interfaz llama a esta función como llamaría a un modelo real.
export async function askAssistant(
  prompt: string,
  draft: string,
  members: string[] = [],
  language: Language = "es",
): Promise<AssistantReply> {
  // Simula el tiempo de respuesta de un modelo.
  await new Promise((resolve) =>
    setTimeout(resolve, 900 + Math.random() * 900),
  );
  return assistantReply(prompt, draft, members, language);
}
// Respuesta simulada, sin la espera: lógica pura que también usan las pruebas unitarias.
export function assistantReply(
  prompt: string,
  draft: string,
  members: string[] = [],
  language: Language = "es",
): AssistantReply {
  const t = (message: string, values?: Record<string, string | number>) =>
    translate(message, language, values);
  const asked = normalize(prompt);
  const written = normalize(draft);
  if (distributionWords.some((word) => asked.includes(word)))
    return distribution(asked, members, language);
  const requested = topics.filter((t) =>
    [...t.keywords, ...(englishKeywords[t.title] ?? [])].some((k) =>
      asked.includes(k),
    ),
  );
  if (requested.length)
    return {
      text: t(
        "Te propongo estos acuerdos sobre {topics}. Ajústalos a lo que decidan en casa antes de publicarlos.",
        {
          topics: join(
            requested.map((topic) => t(topic.title)),
            language,
          ),
        },
      ),
      clauses: requested.flatMap((topic) =>
        topic.clauses.map((clause) => t(clause)),
      ),
    };
  const missing = topics
    .filter(
      (t) =>
        ![...t.keywords, ...(englishKeywords[t.title] ?? [])].some((k) =>
          written.includes(k),
        ),
    )
    .slice(0, 3);
  const intro = /revis|borrador|review|draft/.test(asked)
    ? t("Revisé tu borrador.")
    : t(
        "No identifiqué un tema concreto en tu mensaje, así que revisé tu borrador.",
      );
  if (!missing.length)
    return {
      text: t(
        "{intro} Ya cubre los temas habituales de convivencia. Verifica que cada acuerdo sea claro y fácil de cumplir.",
        { intro },
      ),
      clauses: [],
    };
  return {
    text: t(
      "{intro} Todavía no habla de {topics}. Estas cláusulas pueden servir de punto de partida:",
      {
        intro,
        topics: join(
          missing.map((topic) => t(topic.title)),
          language,
        ),
      },
    ),
    clauses: missing.map((topic) => t(topic.clauses[0])),
  };
}
