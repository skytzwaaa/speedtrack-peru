import { Atom, ChevronDown } from "lucide-react";
import { useI18n } from "../i18n";
import type { Session } from "../types";
export function PhysicsPanel({ session }: { session: Session }) {
  const { t } = useI18n();
  const accuracy = session.measurements.at(-1)?.accuracy;
  return (
    <details className="physics card">
      <summary>
        <span>
          <Atom size={20} />
          {t("physics")}
        </span>
        <ChevronDown size={18} />
      </summary>
      <div className="physics-content">
        <div className="formula">
          <span>{t("physicsFormula")}</span>
          <strong>v = d / t</strong>
          <span>
            {session.distance.toFixed(2)} km /{" "}
            {(session.duration / 3600).toFixed(3)} h ≈{" "}
            {session.avg_speed.toFixed(1)} km/h
          </span>
        </div>
        <div className="formula">
          <span>{t("averageVelocity")}</span>
          <strong>v = Δx / Δt</strong>
        </div>
        <div className="formula">
          <span>{t("averageAcceleration")}</span>
          <strong>a = Δv / Δt</strong>
        </div>
        <div className="formula">
          <span>{t("conversion")}</span>
          <strong>km/h = m/s × 3.6</strong>
        </div>
        {(
          [
            "displacement",
            "velocity",
            "acceleration",
            "mru",
            "mruv",
            "uncertainty",
          ] as const
        ).map((k) => (
          <p key={k}>
            <b>{t(k)}</b>
            <br />
            {t(`${k}Desc`)}
          </p>
        ))}
        <div className="notice">
          {t("accuracy")}:{" "}
          {session.demo
            ? t("simulatedAccuracy")
            : accuracy != null
              ? `± ${Math.round(accuracy)} ${t("meter")}`
              : t("unknownAccuracy")}
        </div>
      </div>
    </details>
  );
}
