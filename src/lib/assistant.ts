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
];
export const assistantExamples = [
  "Reglas para las visitas",
  "Horarios de silencio",
  "¿Cómo repartimos el aseo?",
  "Revisa mi borrador",
];
const normalize = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const join = (items: string[]) =>
  items.length > 1
    ? `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`
    : items[0];
export async function askAssistant(
  prompt: string,
  draft: string,
): Promise<AssistantReply> {
  // Simula el tiempo de respuesta de un modelo.
  await new Promise((resolve) =>
    setTimeout(resolve, 900 + Math.random() * 900),
  );
  const asked = normalize(prompt);
  const written = normalize(draft);
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
