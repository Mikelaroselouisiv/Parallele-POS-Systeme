export type UserAttribution = {
  id: number;
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
};

export function formatUserLabel(user?: UserAttribution | null): string {
  if (!user) return '—';
  const name = user.fullName?.trim();
  if (name) return name;
  const phone = user.phone?.trim();
  if (phone) return phone;
  const email = user.email?.trim();
  if (email) return email;
  return '—';
}
