import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

let theme: Theme = "light";
const listeners = new Set<() => void>();

function apply(next: Theme) {
  theme = next;
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("wf-theme", next);
    } catch {
      // ignore
    }
  }
  listeners.forEach((l) => l());
}

// Hydrate on the client after mount to avoid SSR mismatch.
export function hydrateTheme() {
  if (typeof window === "undefined") return;
  try {
    const saved = localStorage.getItem("wf-theme") as Theme | null;
    if (saved && saved !== theme) apply(saved);
  } catch {
    // ignore
  }
}

export const themeStore = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  get() {
    return theme;
  },
  toggle() {
    apply(theme === "light" ? "dark" : "light");
  },
};

export function useTheme(): Theme {
  return useSyncExternalStore(themeStore.subscribe, themeStore.get, () => "light");
}
