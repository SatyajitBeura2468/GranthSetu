"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    const saved = (localStorage.getItem("granthsetu-theme") as Theme | null) ?? "system";
    queueMicrotask(() => setTheme(saved)); applyTheme(saved);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => { if ((localStorage.getItem("granthsetu-theme") ?? "system") === "system") applyTheme("system"); };
    media.addEventListener("change", update); return () => media.removeEventListener("change", update);
  }, []);
  function cycle() {
    const next: Theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next); localStorage.setItem("granthsetu-theme", next); applyTheme(next);
  }
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  return <button className={`theme-toggle${compact ? " theme-toggle-compact" : ""}`} type="button" onClick={cycle} aria-label={`Theme: ${theme}. Change theme`} title={`Theme: ${theme}`}><Icon aria-hidden="true" /><span>{compact ? "" : theme[0].toUpperCase() + theme.slice(1)}</span></button>;
}
