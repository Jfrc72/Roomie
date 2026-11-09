export function canRemoveAdmin(role: string, nextRole: string | null, adminCount: number) {
  return role !== 'admin' || nextRole === 'admin' || adminCount > 1;
}

export function invitationProblem(data: {
  status: string; expiresAt: Date; email: string; userEmail: string; count: number; existing: boolean;
}, now = new Date()) {
  if (data.status !== 'pending' || data.expiresAt <= now) return 'expired';
  if (data.email !== data.userEmail) return 'email';
  if (data.existing) return 'member';
  if (data.count >= 8) return 'capacity';
  return null;
}
