/** Sélection Prisma standard pour afficher l'auteur d'une action. */
export const USER_ATTRIBUTION_SELECT = {
  id: true,
  fullName: true,
  phone: true,
  email: true,
} as const;

export type UserAttribution = {
  id: number;
  fullName: string | null;
  phone: string;
  email: string | null;
};

export function formatUserAttribution(
  user?: { fullName?: string | null; phone?: string | null; email?: string | null } | null,
): string {
  if (!user) return '—';
  const name = user.fullName?.trim();
  if (name) return name;
  const phone = user.phone?.trim();
  if (phone) return phone;
  const email = user.email?.trim();
  if (email) return email;
  return '—';
}
