"use client";
import { useLanguage } from "@/context/LanguageContext";
import { PageTitle } from "@/components/ui";
export default function Page() {
  const { t } = useLanguage();
  return (
    <>
      <PageTitle
        title={t("Una mano para empezar")}
        description={t("Respuestas sencillas para organizar tu hogar.")}
      />
      <section className="panel help">
        <h2>{t("Preguntas frecuentes")}</h2>
        {[
          [
            "¿Cómo invito a mis roommates?",
            "En Mi apartamento, un administrador escribe el correo y genera un enlace. La persona debe registrarse o iniciar sesión con ese mismo correo y aceptarlo. El enlace vence en 7 días.",
          ],
          [
            "¿Qué puede hacer un administrador?",
            "Puede editar el hogar, invitar o retirar integrantes y cambiar sus roles. Siempre debe quedar al menos un administrador.",
          ],
          [
            "¿Puedo estar en varios apartamentos?",
            "Sí. Crea otro desde Mi apartamento o acepta una invitación. Usa el selector de la barra superior para cambiar de hogar. Los datos se mantienen separados.",
          ],
          [
            "¿Qué pasa si retiro a alguien?",
            "Pierde acceso al apartamento. Se conserva su registro para no perder el historial de las operaciones que los módulos asocien a esa persona.",
          ],
          [
            "¿Dónde se guardan los cambios?",
            "En la base de datos. Cerrar sesión o recargar la página no elimina tu apartamento ni tus datos.",
          ],
          [
            "¿Cómo se reparten las tareas?",
            "En Tareas cualquier integrante crea una tarea, elige responsable, prioridad y fecha límite. Solo quien la creó o un administrador pueden editarla, moverla entre Pendiente, En progreso y Completada o eliminarla. Si no tiene responsable, cualquier integrante puede empezarla o completarla, pero no editarla.",
          ],
          [
            "¿Cómo funcionan las reservas?",
            "Los administradores agregan los espacios u objetos que se turnan, como la lavadora o la sala. Cualquier integrante puede reservarlos hasta por 7 días, siempre que el horario no se cruce con otra reserva. Quien reservó o un administrador pueden cancelarla y el horario queda libre. El calendario semanal muestra qué está ocupado cada día.",
          ],
          [
            "¿Cómo funcionan las votaciones?",
            "Cualquier integrante abre una votación con 2 a 10 opciones y elige cómo se decide: por mayoría simple (gana la opción con más votos y un empate no tiene ganadora) o por unanimidad (gana solo si todos votan por la misma opción). Puedes cambiar tu voto mientras siga abierta; los resultados aparecen al cerrarla. En las anónimas nadie ve qué eligió cada persona. La cierran quien la creó, un administrador o la fecha de cierre automático; quien no votó cuenta como abstención.",
          ],
          [
            "¿Cómo funcionan los acuerdos del hogar?",
            "Los administradores redactan y publican versiones del reglamento; un asistente de demostración sugiere cláusulas y propone un reparto equitativo de las tareas si le cuentas que no se están cumpliendo. Cada integrante lee la versión vigente y la acepta, y todos ven quién falta. Al publicar una versión nueva hay que aceptarla de nuevo. Aceptar es un registro de lectura, no una firma electrónica certificada. Si alguien no cumple un acuerdo, cualquier integrante puede reportarlo: se avisa a los administradores y a la persona señalada, y un administrador lo marca como resuelto.",
          ],
          [
            "¿Con qué módulos cuenta Roomie?",
            "Roomie incluye apartamento, cuentas, notificaciones, gastos, compras, mantenimiento, tareas, reservas, votaciones y acuerdos.",
          ],
          [
            "¿Cómo funcionan los recordatorios?",
            "Las notificaciones aparecen en tu bandeja. Puedes elegir la anticipación desde Notificaciones. Los correos y push necesitan estar habilitados por el administrador técnico.",
          ],
        ].map(([title, text]) => (
          <details key={title}>
            <summary>{t(title)}</summary>
            <p>{t(text)}</p>
          </details>
        ))}
      </section>
    </>
  );
}
