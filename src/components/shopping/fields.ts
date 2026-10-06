export const categories = [
  "Alimentos",
  "Limpieza",
  "Utensilios",
  "Hogar",
  "Varios",
];

export function itemBody(form: FormData) {
  return {
    title: String(form.get("title") ?? ""),
    category: String(form.get("category") ?? "Varios"),
    quantity: Number(form.get("quantity")),
    estimated_price: Number(form.get("estimated_price") || 0),
    assigned_membership_id:
      String(form.get("assigned_membership_id") ?? "") || null,
  };
}
