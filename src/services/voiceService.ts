import { Capacitor, registerPlugin } from "@capacitor/core";
import type { Language } from "../types";
import { translate } from "../i18n";
const locales: Record<Language, string> = {
  es: "es-PE",
  en: "en-US",
  qu: "qu-PE",
};
const native = registerPlugin<{
  available(): Promise<{ languages: string[] }>;
  speak(options: {
    text: string;
    language: string;
    volume: number;
  }): Promise<void>;
  stop(): Promise<void>;
}>("SpeedTrackVoice");
export interface VoiceProvider {
  speak(text: string, language: Language, volume: number): Promise<void>;
  cancel(): void;
}
// One active utterance; FIFO within priority. Generation prevents cancelled
// provider completions from consuming a newer queue.
export class VoiceQueue {
  private items: {
    text: string;
    language: Language;
    volume: number;
    priority: number;
  }[] = [];
  private active = false;
  private generation = 0;
  constructor(private provider: VoiceProvider) {}
  enqueue(text: string, language: Language, volume: number, priority = 0) {
    if (this.items.some((i) => i.text === text)) return;
    this.items.push({ text, language, volume, priority });
    this.items.sort((a, b) => b.priority - a.priority);
    this.items = this.items.slice(0, 12);
    this.next();
  }
  cancel() {
    this.generation++;
    this.items = [];
    this.active = false;
    this.provider.cancel();
  }
  private next() {
    if (this.active) return;
    const item = this.items.shift();
    if (!item) return;
    this.active = true;
    const generation = this.generation;
    void this.provider
      .speak(item.text, item.language, item.volume)
      .catch(() => {})
      .finally(() => {
        if (generation !== this.generation) return;
        this.active = false;
        this.next();
      });
  }
}
let language: Language = "es";
let fallback: "off" | "es" | "en" = "off";
let volume = 0.8;
let nativeLanguages: string[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
export const isSpeechSupported = () =>
  Capacitor.isNativePlatform() ||
  (typeof window !== "undefined" && "speechSynthesis" in window);
export async function refreshVoices() {
  if (Capacitor.isNativePlatform()) {
    try {
      nativeLanguages = (await native.available()).languages;
    } catch {
      nativeLanguages = [];
    }
  }
  notify();
}
export function subscribeVoices(listener: () => void) {
  listeners.add(listener);
  if (!Capacitor.isNativePlatform() && isSpeechSupported())
    speechSynthesis.addEventListener("voiceschanged", notify);
  void refreshVoices();
  return () => {
    listeners.delete(listener);
    if (!Capacitor.isNativePlatform() && isSpeechSupported())
      speechSynthesis.removeEventListener("voiceschanged", notify);
  };
}
export const hasCompatibleVoice = (lang: Language) =>
  Capacitor.isNativePlatform()
    ? nativeLanguages.some((v) => v.toLowerCase().startsWith(lang))
    : isSpeechSupported() &&
      speechSynthesis
        .getVoices()
        .some((v) => v.lang.toLowerCase().startsWith(lang));
let finishWeb: (() => void) | undefined;
const webProvider: VoiceProvider = {
  speak: (text, lang, level) =>
    new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = locales[lang];
      utterance.volume = level;
      utterance.voice =
        speechSynthesis
          .getVoices()
          .find((v) => v.lang.toLowerCase() === locales[lang].toLowerCase()) ??
        speechSynthesis
          .getVoices()
          .find((v) => v.lang.toLowerCase().startsWith(lang)) ??
        null;
      const done = () => {
        clearTimeout(timeout);
        if (finishWeb === done) finishWeb = undefined;
        resolve();
      };
      const timeout = setTimeout(() => {
        speechSynthesis.cancel();
        done();
      }, 30000);
      finishWeb = done;
      utterance.onend = utterance.onerror = done;
      speechSynthesis.speak(utterance);
    }),
  cancel: () => {
    finishWeb?.();
    if (isSpeechSupported()) speechSynthesis.cancel();
  },
};
const queue = new VoiceQueue(
  Capacitor.isNativePlatform()
    ? {
        speak: (text, lang, level) =>
          native.speak({ text, language: locales[lang], volume: level }),
        cancel: () => {
          void native.stop().catch(() => {});
        },
      }
    : webProvider,
);
export const setVoiceLanguage = (value: Language) => {
  if (language !== value) queue.cancel();
  language = value;
};
export const setVoiceFallback = (value: typeof fallback) => {
  fallback = value;
};
export const setVoiceVolume = (value: number) => {
  volume = Math.max(0, Math.min(1, value));
};
export function speak(text: string, priority = 0) {
  if (hasCompatibleVoice(language))
    queue.enqueue(text, language, volume, priority);
}
export function announceVoice(
  key: Parameters<typeof translate>[1],
  values?: Record<string, string | number>,
  priority = 0,
) {
  const chosen = hasCompatibleVoice(language)
    ? language
    : fallback !== "off" && hasCompatibleVoice(fallback)
      ? fallback
      : null;
  if (chosen)
    queue.enqueue(translate(chosen, key, values), chosen, volume, priority);
}
export const stopSpeaking = () => queue.cancel();
export const voiceService = {
  announce: announceVoice,
  cancel: stopSpeaking,
  refresh: refreshVoices,
  subscribe: subscribeVoices,
};
