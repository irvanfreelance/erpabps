/** UI-only session marker. Not an authenticated Google session. */
export const UI_SESSION_COOKIE = "crm_ui_session";

const MAX_AGE = 60 * 60 * 24 * 30;

export function markSignedIn() {
  document.cookie = `${UI_SESSION_COOKIE}=1; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax`;
}

export function markSignedOut() {
  document.cookie = `${UI_SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function safeNextPath(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/login")) return "/dashboard";
  return raw;
}
