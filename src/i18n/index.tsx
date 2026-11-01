import { createContext, useContext } from "react";
import { es, type TranslationKey } from "./es";
import { en } from "./en";
import { qu } from "./qu";
import type { Language } from "../types";
export const dictionaries = { es, en, qu };
export function translate(
  language: Language,
  key: TranslationKey,
  values: Record<string, string | number> = {},
) {
  return Object.entries(values).reduce(
    (text, [k, v]) => text.replaceAll(`{${k}}`, String(v)),
    dictionaries[language]?.[key] || es[key] || String(key),
  );
}
export const I18nContext = createContext<Language>("es");
export function useI18n() {
  const language = useContext(I18nContext);
  return {
    language,
    t: (key: TranslationKey, values?: Record<string, string | number>) =>
      translate(language, key, values),
  };
}
