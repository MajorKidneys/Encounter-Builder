/** Viewing preference only. Stays in localStorage, never in the campaign data file. */
export type ThemeChoice = "light" | "dark" | "auto";

const KEY = "dm-theme-v1";

export function readTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(KEY);
    if (value === "light" || value === "dark" || value === "auto") return value;
  } catch {
    /* storage may be unavailable */
  }
  return "auto";
}

export function themeIsDark(choice: ThemeChoice): boolean {
  if (choice === "dark") return true;
  if (choice === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(choice: ThemeChoice) {
  const dark = themeIsDark(choice);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function writeTheme(choice: ThemeChoice) {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* storage may be unavailable */
  }
  applyTheme(choice);
}
