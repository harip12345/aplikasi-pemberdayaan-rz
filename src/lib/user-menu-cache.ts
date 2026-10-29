export const USER_MENU_CACHE_KEY = "rz-user-menu-profile-v1";

export type UserMenuProfile = {
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: "admin" | "member";
};

export function readUserMenuProfile(): UserMenuProfile | null {
  try {
    const raw = window.sessionStorage.getItem(USER_MENU_CACHE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const profile = value as Partial<UserMenuProfile>;
    if (typeof profile.email !== "string" || typeof profile.fullName !== "string") return null;
    return {
      email: profile.email,
      fullName: profile.fullName,
      avatarUrl: typeof profile.avatarUrl === "string" ? profile.avatarUrl : null,
      role: profile.role === "admin" ? "admin" : "member",
    };
  } catch {
    return null;
  }
}

export function writeUserMenuProfile(profile: UserMenuProfile | null) {
  try {
    if (profile) window.sessionStorage.setItem(USER_MENU_CACHE_KEY, JSON.stringify(profile));
    else window.sessionStorage.removeItem(USER_MENU_CACHE_KEY);
  } catch {
    // Profil visual tetap dapat dimuat ulang dari sesi server.
  }
}
