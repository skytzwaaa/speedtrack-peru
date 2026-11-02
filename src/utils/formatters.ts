import type { Language } from "../types";
const two = (n: number) => n.toString().padStart(2, "0");
// mm:ss por debajo de una hora; h:mm:ss a partir de ahí (también para totales).
export const duration = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${two(m)}:${two(s % 60)}` : `${two(m)}:${two(s % 60)}`;
};
// El ritmo son segundos por km: siempre mm:ss.
export const pace = (seconds: number) => {
  if (!(seconds > 0)) return "—";
  const s = Math.round(seconds);
  return `${two(Math.floor(s / 60))}:${two(s % 60)}`;
};
export const number = (n: number, language: Language, digits = 1) =>
  new Intl.NumberFormat(language === "en" ? "en-US" : "es-PE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
export const date = (value: string, language: Language) =>
  new Intl.DateTimeFormat(
    language === "qu" ? "qu-PE" : language === "en" ? "en-US" : "es-PE",
    {
      day: "2-digit",
      month: language === "qu" ? "2-digit" : "long",
      year: "numeric",
    },
  ).format(new Date(value));
