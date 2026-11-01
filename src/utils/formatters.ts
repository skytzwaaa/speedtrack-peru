import type { Language } from "../types";
export const duration = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
};
export const pace = (seconds: number) =>
  seconds > 0 ? duration(seconds) : "—";
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
