import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Activity,
  Car,
  Bike,
  Footprints,
} from "lucide-react";
import { useI18n } from "../i18n";
import type { ActivityType, Session } from "../types";
import { date, duration, number, pace } from "../utils/formatters";
import { calculateAveragePace } from "../utils/physics";
export function PageHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-heading">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {children}
    </header>
  );
}
export function Metric({
  label,
  value,
  unit,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div className={`metric ${accent ? "accent" : ""}`}>
      <span>{label}</span>
      <strong>
        {value} {unit && <small>{unit}</small>}
      </strong>
    </div>
  );
}
export function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="section">
      <div className="section-heading">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Back({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button className="back-button" onClick={onClick}>
      <ArrowLeft size={17} />
      {t("back")}
    </button>
  );
}
export function TypeIcon({
  type,
  size = 22,
}: {
  type: ActivityType;
  size?: number;
}) {
  const Icon =
    type === "vehicle"
      ? Car
      : type === "bike"
        ? Bike
        : type === "walk"
          ? Footprints
          : Activity;
  return <Icon size={size} />;
}
export function SessionCard({
  session,
  onClick,
}: {
  session: Session;
  onClick: () => void;
}) {
  const { t, language } = useI18n();
  return (
    <button className="session-card" onClick={onClick}>
      <span className={`type-icon ${session.type === "vehicle" ? "blue" : ""}`}>
        <TypeIcon type={session.type} />
      </span>
      <span className="session-content">
        <strong>
          {t(session.type)}
          {session.demo && <small> · {t("simulated")}</small>}
        </strong>
        <small>{date(session.start_time, language)}</small>
        <span>
          <b>
            {number(session.distance, language, 2)} {t("distanceUnit")}
          </b>
          <span className="dot">·</span>
          {duration(session.duration)}
        </span>
        <small>
          {session.type === "vehicle"
            ? `${t("maxSpeed")} ${number(session.max_speed, language)} ${t("speedUnit")}`
            : session.type === "bike"
              ? `${t("avgSpeed")} ${number(session.avg_speed, language)} ${t("speedUnit")}`
              : `${t("avgPace")} ${pace(calculateAveragePace(session.distance, session.duration))}/${t("distanceUnit")}`}
        </small>
      </span>
      <ArrowUpRight size={19} />
    </button>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <label className="setting-row">
      <span>
        {label}
        <small>{t(checked ? "enabled" : "disabled")}</small>
      </span>
      <input
        className="switch"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
    </label>
  );
}
