export const INTERNAL_EMAIL_DOMAIN = "rumahzakat.org";

const DEFAULT_ADMIN_EMAILS = [
  "hari.pamungkas@rumahzakat.org",
  "candra.juari@rumahzakat.org",
  "pd.rumahzakat@gmail.com",
];

export function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("id-ID");
}

export function configuredAdminEmails() {
  const configured = process.env.AUTH_ADMIN_EMAILS?.split(",").map(normalizeEmail).filter(Boolean) ?? [];
  return new Set(configured.length ? configured : DEFAULT_ADMIN_EMAILS);
}

export function isInternalEmail(email: string | null | undefined) {
  return normalizeEmail(email).endsWith(`@${INTERNAL_EMAIL_DOMAIN}`);
}

export function isAdminEmail(email: string | null | undefined) {
  return configuredAdminEmails().has(normalizeEmail(email));
}

