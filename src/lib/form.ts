export type FormState = { error?: string; ok?: string };

export const USERNAME_RE = /^[a-z0-9._-]{2,32}$/;

export function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}
