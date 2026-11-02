import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { storageService } from "./storageService";
import { watchGps } from "./gpsService";
import { hasCompatibleVoice, setVoiceLanguage, speak } from "./voiceService";
import { fixtureSession } from "../test/fixtures";

afterEach(() => vi.unstubAllGlobals());
describe("local persistence", () => {
  const data = new Map<string, string>();
  beforeEach(() => {
    data.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
    });
  });
  it("restores a saved journey with its measurements, events and splits", () => {
    const session = fixtureSession("run");
    expect(storageService.saveSessions([session])).toBe(true);
    expect(storageService.loadSessions()).toEqual([session]);
  });
  it("recovers from malformed preferences and stored JSON", () => {
    data.set("speedtrack.sessions.v1", "invalid");
    expect(storageService.loadSessions()).toEqual([]);
    data.set(
      "speedtrack.settings.v1",
      JSON.stringify({
        language: "unknown",
        voice_volume: 7,
        voice_enabled: "false",
        speed_limit: -50,
      }),
    );
    const settings = storageService.loadSettings();
    expect(settings.language).toBe("es");
    expect(settings.voice_enabled).toBe(false);
    expect(settings.voice_volume).toBe(1);
    expect(settings.speed_limit).toBe(50);
  });
  it("reports storage failure without throwing", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });
    expect(storageService.saveSessions([fixtureSession("vehicle")])).toBe(
      false,
    );
  });
});
describe("optional device APIs", () => {
  it("falls back when GPS is unavailable", () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("window", { isSecureContext: true });
    const error = vi.fn();
    const stop = watchGps(vi.fn(), error);
    expect(error).toHaveBeenCalledOnce();
    expect(stop).not.toThrow();
  });
  it("requests GPS only through the explicit start service and releases its watcher", () => {
    const watchPosition = vi.fn().mockReturnValue(42),
      clearWatch = vi.fn();
    vi.stubGlobal("navigator", { geolocation: { watchPosition, clearWatch } });
    vi.stubGlobal("window", { isSecureContext: true });
    const stop = watchGps(vi.fn(), vi.fn());
    expect(watchPosition).toHaveBeenCalledOnce();
    stop();
    expect(clearWatch).toHaveBeenCalledWith(42);
  });
  it("never substitutes a different language when no Quechua voice exists", () => {
    const speech = {
      getVoices: () => [{ lang: "es-PE" }],
      speak: vi.fn(),
      cancel: vi.fn(),
    };
    vi.stubGlobal("window", { speechSynthesis: speech });
    vi.stubGlobal("speechSynthesis", speech);
    setVoiceLanguage("qu");
    expect(hasCompatibleVoice("qu")).toBe(false);
    speak("Qallariy");
    expect(speech.speak).not.toHaveBeenCalled();
    setVoiceLanguage("es");
  });
});
