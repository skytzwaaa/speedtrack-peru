import type { Session, Settings, User } from "../types";
import { validSession } from "./activityRepository";
import { seedSessions } from "../data/seed";
export const defaultSettings: Settings = {
  id: "local-settings",
  user_id: "local-user",
  language: "es",
  units: "metric",
  voice_enabled: false,
  voice_language: "es",
  voice_volume: 0.8,
  kilometer_alerts: true,
  safety_alerts: true,
  approaching_alerts: true,
  speed_limit: 50,
};
const read = (key: string): unknown => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};
export const storageService = {
  loadSessions(owner = "local-user"): Session[] {
    const data = read(
      owner === "local-user"
        ? "speedtrack.sessions.v1"
        : `speedtrack.sessions.${owner}`,
    );
    if (!Array.isArray(data))
      return owner === "local-user" ? seedSessions() : [];
    const valid = data.filter(validSession);
    return owner === "local-user"
      ? valid
      : valid.filter((s) => s.user_id === owner);
  },
  saveSessions(sessions: Session[], owner = "local-user") {
    try {
      localStorage.setItem(
        owner === "local-user"
          ? "speedtrack.sessions.v1"
          : `speedtrack.sessions.${owner}`,
        JSON.stringify(sessions),
      );
      return true;
    } catch {
      return false;
    }
  },
  loadSettings(owner = "local-user"): Settings {
    const raw = read(
      owner === "local-user"
        ? "speedtrack.settings.v1"
        : `speedtrack.settings.${owner}`,
    );
    if (!raw || typeof raw !== "object") return defaultSettings;
    const s = raw as Partial<Settings>;
    return {
      ...defaultSettings,
      ...s,
      units: "metric",
      voice_fallback:
        s.voice_fallback === "es" || s.voice_fallback === "en"
          ? s.voice_fallback
          : "off",
      progress_alerts: s.progress_alerts === true,
      voice_volume:
        typeof s.voice_volume === "number" && Number.isFinite(s.voice_volume)
          ? Math.max(0, Math.min(1, s.voice_volume))
          : defaultSettings.voice_volume,
      voice_enabled:
        typeof s.voice_enabled === "boolean"
          ? s.voice_enabled
          : defaultSettings.voice_enabled,
      kilometer_alerts:
        typeof s.kilometer_alerts === "boolean"
          ? s.kilometer_alerts
          : defaultSettings.kilometer_alerts,
      safety_alerts:
        typeof s.safety_alerts === "boolean"
          ? s.safety_alerts
          : defaultSettings.safety_alerts,
      approaching_alerts:
        typeof s.approaching_alerts === "boolean"
          ? s.approaching_alerts
          : defaultSettings.approaching_alerts,
      language: ["es", "en", "qu"].includes(s.language ?? "")
        ? s.language!
        : "es",
      voice_language: ["es", "en", "qu"].includes(s.voice_language ?? "")
        ? s.voice_language!
        : "es",
      speed_limit:
        typeof s.speed_limit === "number" &&
        s.speed_limit >= 10 &&
        s.speed_limit <= 130
          ? s.speed_limit
          : 50,
    };
  },
  saveSettings(settings: Settings, owner = "local-user") {
    try {
      localStorage.setItem(
        owner === "local-user"
          ? "speedtrack.settings.v1"
          : `speedtrack.settings.${owner}`,
        JSON.stringify(settings),
      );
      const user: User = {
        id: "local-user",
        name: "",
        email: "",
        language: settings.language,
        voice_enabled: settings.voice_enabled,
      };
      localStorage.setItem(`speedtrack.user.${owner}`, JSON.stringify(user));
      return true;
    } catch {
      return false;
    }
  },
};
