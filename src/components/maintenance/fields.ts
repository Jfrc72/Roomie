import type {
  MaintenancePriority,
  MaintenanceStatus,
} from "@/types/shared-modules";

export const categories = [
  "Plomería",
  "Electricidad",
  "Carpintería",
  "Electrodomésticos",
  "Estructura",
  "Otros",
];

export const priorities: MaintenancePriority[] = [
  "BAJA",
  "MEDIA",
  "ALTA",
  "URGENTE",
];

export const statuses: MaintenanceStatus[] = [
  "PENDIENTE",
  "EN_PROGRESO",
  "RESUELTO",
];

export const statusLabels: Record<MaintenanceStatus, string> = {
  PENDIENTE: "Pendiente",
  EN_PROGRESO: "En progreso",
  RESUELTO: "Resuelto",
};

export const priorityLabels: Record<MaintenancePriority, string> = {
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

export function reportBody(form: FormData) {
  return {
    title: String(form.get("title") ?? ""),
    description: String(form.get("description") ?? ""),
    category: String(form.get("category") ?? "Otros"),
    estimated_cost: form.get("estimated_cost")
      ? Number(form.get("estimated_cost"))
      : null,
    priority: String(form.get("priority") ?? "MEDIA"),
    assigned_membership_id:
      String(form.get("assigned_membership_id") ?? "") || null,
  };
}
