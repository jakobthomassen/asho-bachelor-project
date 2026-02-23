const PROFILE_NAME_KEY = "asho_profile_name";

export function getProfileName(): string {
  try {
    return localStorage.getItem(PROFILE_NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveProfileName(name: string): void {
  localStorage.setItem(PROFILE_NAME_KEY, name.trim());
}
