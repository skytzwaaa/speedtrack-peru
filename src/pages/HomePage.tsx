import {
  Activity,
  ArrowRight,
  Car,
  ChevronRight,
  Flame,
  MoveUpRight,
  Navigation,
  Radio,
} from "lucide-react";
import type { Session, Tab } from "../types";
import { useI18n } from "../i18n";
import { number } from "../utils/formatters";
import { PageHeading, Section, SessionCard } from "../components/ui";
import { Statistics } from "../components/Statistics";
import { useAuth } from "../hooks/useAuth";
export function HomePage({
  sessions,
  navigate,
  open,
}: {
  sessions: Session[];
  navigate: (tab: Tab) => void;
  open: (s: Session) => void;
}) {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const now = new Date(),
    start = new Date(now);
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  const weekly = sessions
    .filter(
      (s) =>
        !s.demo &&
        s.type !== "vehicle" &&
        new Date(s.start_time) >= start &&
        new Date(s.start_time) <= now,
    )
    .reduce((a, s) => a + s.distance, 0);
  return (
    <>
      <div className="home-brand">
        <div className="brand-icon">
          <Navigation size={21} fill="currentColor" />
        </div>
        <span>
          SpeedTrack<span className="brand-peru"> Perú</span>
        </span>
        <span className="brand-status">
          <Radio size={14} />
        </span>
      </div>
      <PageHeading
        eyebrow={
          user
            ? t("greetUser", { name: user.user_metadata.name || t("member") })
            : t("greeting")
        }
        title={t("welcome")}
      >
        <p>{t("tagline")}</p>
      </PageHeading>
      <div className="hero-card">
        <div className="hero-top">
          <span className="pill">
            <Flame size={13} />
            {t("best")}
          </span>
          <MoveUpRight size={21} />
        </div>
        <div className="hero-number">
          {number(weekly, language, 2)}
          <small>{t("distanceUnit")}</small>
        </div>
        <span className="hero-label">{t("weekly")}</span>
        <svg className="hero-wave" viewBox="0 0 340 100" aria-hidden="true">
          <path
            d="M0 85C20 85 30 65 50 70S80 98 105 50S140 80 165 44S205 64 220 35S260 65 280 18S315 38 340 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            d="M0 85C20 85 30 65 50 70S80 98 105 50S140 80 165 44S205 64 220 35S260 65 280 18S315 38 340 5V100H0Z"
            fill="currentColor"
            opacity=".08"
          />
        </svg>
        <div className="hero-footer">
          <span>{t("today")}</span>
          <span className="hero-dot" />
        </div>
      </div>
      <Section title={t("explore")}>
        <div className="mode-grid">
          <button
            className="mode-card sport-mode"
            onClick={() => navigate("activity")}
          >
            <span className="mode-icon">
              <Activity size={26} />
            </span>
            <ArrowRight className="mode-arrow" size={18} />
            <h3>{t("physical")}</h3>
            <p>{t("physicalDesc")}</p>
            <span className="mode-link">
              {t("startActivity")} <ChevronRight size={13} />
            </span>
          </button>
          <button
            className="mode-card vehicle-mode"
            onClick={() => navigate("vehicle")}
          >
            <span className="mode-icon">
              <Car size={26} />
            </span>
            <ArrowRight className="mode-arrow" size={18} />
            <h3>{t("vehicle")}</h3>
            <p>{t("vehicleDesc")}</p>
            <span className="mode-link">
              {t("startVehicle")} <ChevronRight size={13} />
            </span>
          </button>
        </div>
      </Section>
      <div className="mini-stats">
        <div>
          <span>{t("sessions")}</span>
          <strong>
            {sessions.filter((s) => !s.demo).length}
            <small>{t("history")}</small>
          </strong>
        </div>
        <div>
          <span>{t("recentMax")}</span>
          <strong>
            {number(
              Math.max(
                0,
                ...sessions
                  .filter((s) => !s.demo)
                  .slice(0, 7)
                  .map((s) => s.max_speed),
              ),
              language,
              0,
            )}
            <small>{t("speedUnit")}</small>
          </strong>
        </div>
      </div>
      <Section
        title={t("lastSession")}
        action={
          <button className="text-button" onClick={() => navigate("history")}>
            {t("all")}
            <ArrowRight size={13} />
          </button>
        }
      >
        {sessions[0] && (
          <SessionCard
            session={sessions[0]}
            onClick={() => open(sessions[0])}
          />
        )}
      </Section>
      <Statistics sessions={sessions} />
      <p className="footnote">{t("academic")}</p>
    </>
  );
}
