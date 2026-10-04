import { PageTitle } from "@/components/ui";
export default function Page() {
  return (
    <>
      <PageTitle
        title="Una mano para empezar"
        description="Respuestas sencillas para organizar tu hogar."
      />
      <section className="panel help">
        <h2>Preguntas frecuentes</h2>
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
            "¿Por qué algunas secciones están en preparación?",
            "Esta versión contiene la administración del hogar y las tareas. Los módulos de gastos y convivencia se incorporarán en las siguientes entregas del equipo.",
          ],
          [
            "¿Cómo funcionan los recordatorios?",
            "Las notificaciones aparecen en tu bandeja. Puedes elegir la anticipación desde Notificaciones. Los correos y push necesitan estar habilitados por el administrador técnico.",
          ],
        ].map(([title, text]) => (
          <details key={title}>
            <summary>{title}</summary>
            <p>{text}</p>
          </details>
        ))}
      </section>
    </>
  );
}
