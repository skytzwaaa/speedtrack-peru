import { useEffect, useState } from "react";
import {
  AudioLines,
  Globe,
  GraduationCap,
  Lock,
  Mic,
  Moon,
  UserRound,
} from "lucide-react";
import type { Language, Settings } from "../types";
import { useI18n } from "../i18n";
import {
  hasCompatibleVoice,
  isSpeechSupported,
  announceVoice,
  subscribeVoices,
} from "../services/voiceService";
import { PageHeading, Section, Toggle } from "../components/ui";
export function ProfilePage({
  settings: s,
  update,
}: {
  settings: Settings;
  update: (settings: Settings) => void;
}) {
  const { t } = useI18n();
  const [, setVoiceVersion] = useState(0);
  useEffect(() => {
    return subscribeVoices(() => setVoiceVersion((v) => v + 1));
  }, []);
  const patch = (changes: Partial<Settings>) => update({ ...s, ...changes });
  const languages = (
    id: string,
    value: Language,
    onChange: (lang: Language) => void,
  ) => (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as Language)}
    >
      <option value="es">{t("spanish")}</option>
      <option value="en">{t("english")}</option>
      <option value="qu">{t("quechua")}</option>
    </select>
  );
  return (
    <>
      <PageHeading eyebrow={t("app")} title={t("profile")} />
      <div className="profile-card card">
        <div className="avatar">
          <UserRound size={28} />
        </div>
        <strong>{t("member")}</strong>
        <span>{t("academic")}</span>
        <small>
          <Lock size={12} />
          {t("local")}
        </small>
      </div>
      <Section title={t("config")}>
        <div className="settings-group card">
          <h3>
            <Globe size={17} />
            {t("general")}
          </h3>
          <label className="setting-row" htmlFor="language">
            <span>{t("language")}</span>
            {languages("language", s.language, (v) => patch({ language: v }))}
          </label>
          {s.language === "qu" && <p className="notice">{t("variant")}</p>}
          <div className="setting-row">
            <span>{t("units")}</span>
            <span className="setting-value">{t("metric")}</span>
          </div>
        </div>
        <div className="settings-group card">
          <h3>
            <AudioLines size={17} />
            {t("accessibility")}
          </h3>
          <Toggle
            label={t("voice")}
            checked={s.voice_enabled}
            onChange={(v) => patch({ voice_enabled: v })}
            disabled={!isSpeechSupported()}
          />
          <label className="setting-row" htmlFor="voice-fallback">
            <span>{t("voiceFallback")}</span>
            <select
              id="voice-fallback"
              value={s.voice_fallback ?? "off"}
              onChange={(e) =>
                patch({ voice_fallback: e.target.value as "off" | "es" | "en" })
              }
            >
              <option value="off">{t("disabled")}</option>
              <option value="es">{t("spanish")}</option>
              <option value="en">{t("english")}</option>
            </select>
          </label>
          <Toggle
            label={t("progressAlerts")}
            checked={s.progress_alerts ?? false}
            onChange={(v) => patch({ progress_alerts: v })}
          />
          {!isSpeechSupported() ? (
            <p className="notice">{t("voiceUnavailable")}</p>
          ) : (
            !hasCompatibleVoice(s.language) && (
              <p className="notice">{t("languageVoiceUnavailable")}</p>
            )
          )}
          <Toggle
            label={t("kilometerAlerts")}
            checked={s.kilometer_alerts}
            onChange={(v) => patch({ kilometer_alerts: v })}
          />
          <Toggle
            label={t("safetyAlerts")}
            checked={s.safety_alerts}
            onChange={(v) => patch({ safety_alerts: v })}
          />
          <Toggle
            label={t("approachingAlerts")}
            checked={s.approaching_alerts}
            onChange={(v) => patch({ approaching_alerts: v })}
          />
          <label className="volume-row" htmlFor="volume">
            <span>
              {t("volume")} <b>{Math.round(s.voice_volume * 100)}%</b>
            </span>
            <input
              id="volume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={s.voice_volume}
              onChange={(e) => patch({ voice_volume: Number(e.target.value) })}
            />
          </label>
          <button
            className="secondary-button full"
            disabled={!isSpeechSupported()}
            onClick={() => announceVoice("voiceTest")}
          >
            <AudioLines size={16} />
            {t("testVoice")}
          </button>
        </div>
        <div className="settings-group card">
          <h3>
            <Moon size={17} />
            {t("appearance")}
          </h3>
          <div className="setting-row">
            <span>{t("dark")}</span>
            <span className="setting-value">{t("enabled")}</span>
          </div>
        </div>
      </Section>
      <div className="future-card">
        <Mic size={21} />
        <div>
          <strong>{t("commands")}</strong>
          <span className="pill">{t("future")}</span>
          <p>{t("commandsDesc")}</p>
        </div>
      </div>
      <Section title={t("about")}>
        <div className="card about-card">
          <GraduationCap size={28} />
          <p>{t("aboutText")}</p>
          <p className="muted">{t("disclaimer")}</p>
          <span className="version">{t("app")} · v2.0</span>
        </div>
      </Section>
    </>
  );
}
