// Reglas compartidas por el backend y las pruebas unitarias.
export function canRemoveAdmin(
  role: string,
  nextRole: string | null,
  adminCount: number,
) {
  return role !== "admin" || nextRole === "admin" || adminCount > 1;
}
export function invitationProblem(
  {
    status,
    expiresAt,
    email,
    userEmail,
    count,
    existing,
  }: {
    status: string;
    expiresAt: Date;
    email: string;
    userEmail: string;
    count: number;
    existing: boolean;
  },
  now = new Date(),
) {
  if (status !== "pending" || expiresAt <= now) return "expired";
  if (email !== userEmail) return "email";
  if (existing) return "member";
  if (count >= 8) return "capacity";
  return null;
}
