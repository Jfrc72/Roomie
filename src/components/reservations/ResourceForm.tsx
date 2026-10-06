"use client";
import { useLanguage } from "@/context/LanguageContext";
import { Form } from "@/components/ui";
import ResourceFields from "./ResourceFields";
import { useState } from "react";
import { CalendarPlus } from "lucide-react";

export default function ResourceForm({
  addResource,
}: {
  addResource: (form: FormData) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [newResource, setNewResource] = useState(0);
  return (
    <section className="panel">
      <div className="section-title">
        <h2>
          <CalendarPlus size={20} /> {t("Agregar un recurso")}
        </h2>
      </div>
      <p>
        {t(
          "Un espacio u objeto que se turnan, como la lavadora, la sala o la bicicleta.",
        )}
      </p>
      {/* La key nueva limpia el formulario después de guardar. */}
      <Form
        key={newResource}
        label={t("Agregar recurso")}
        success={t("Recurso agregado.")}
        onSave={async (form) => {
          await addResource(form);
          setNewResource((v) => v + 1);
        }}
      >
        <ResourceFields />
      </Form>
    </section>
  );
}
