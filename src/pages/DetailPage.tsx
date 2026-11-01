import { Check, AlertTriangle, ShieldCheck } from "lucide-react";
import type { Session } from "../types";
import { useI18n } from "../i18n";
import { duration, number, pace, date } from "../utils/formatters";
import { calculateAveragePace, calculatePace } from "../utils/physics";
import { Back, PageHeading, Metric, Section } from "../components/ui";
import { SpeedChart } from "../components/SpeedChart";
import { Splits } from "../components/Splits";
import { PhysicsPanel } from "../components/PhysicsPanel";
import { RouteMap } from "../components/RouteMap";
export function DetailPage({
  session: s,
  onBack,
  summary = false,
}: {
  session: Session;
  onBack: () => void;
  summary?: boolean;
}) {
  const { t, language } = useI18n();
  const vehicle = s.type === "vehicle";
  return (
    <>
      <Back onClick={onBack} />
      <PageHeading
        eyebrow={t(s.type)}
        title={t(
          summary ? (vehicle ? "vehicleSummary" : "sportSummary") : "detail",
        )}
      >
        <p>{date(s.start_time, language)}</p>
      </PageHeading>
      {vehicle && (
        <div className="driving-notice">
          <ShieldCheck size={20} />
          <p>{t("driving")}</p>
        </div>
      )}
      {summary && (
        <div className="saved-message">
          <Check size={16} />
          {t("saved")}
        </div>
      )}
      <div className="summary-hero card">
        <span>{t("distance")}</span>
        <strong>
          {number(s.distance, language, 2)}
          <small>{t("distanceUnit")}</small>
        </strong>
        <span>
          {duration(s.duration)} · {t(s.demo ? "simulated" : "realGps")}
        </span>
      </div>
      <div className="metric-grid card">
        <Metric label={t("time")} value={duration(s.duration)} />
        <Metric
          label={t("avgSpeed")}
          value={number(s.avg_speed, language)}
          unit={t("speedUnit")}
        />
        <Metric
          label={t("maxSpeed")}
          value={number(s.max_speed, language)}
          unit={t("speedUnit")}
        />
        <Metric
          label={t("maxAcceleration")}
          value={number(s.max_acceleration, language, 2)}
          unit={t("accelerationUnit")}
        />
        {vehicle ? (
          <>
            <Metric
              label={t("maxDeceleration")}
              value={number(s.max_deceleration, language, 2)}
              unit={t("accelerationUnit")}
            />
            <Metric
              label={t("brakes")}
              value={s.events.filter((e) => e.type === "brake").length}
            />
            <Metric
              label={t("accelerations")}
              value={s.events.filter((e) => e.type === "accelerate").length}
            />
            <Metric label={t("aboveTime")} value={duration(s.above_limit)} />
          </>
        ) : (
          <>
            <Metric
              label={t("avgPace")}
              value={pace(calculateAveragePace(s.distance, s.duration))}
              unit={t("paceUnit")}
            />
            <Metric
              label={t("bestPace")}
              value={pace(calculatePace(s.max_speed))}
              unit={t("paceUnit")}
            />
            <Metric label={t("kilometers")} value={Math.floor(s.distance)} />
          </>
        )}
      </div>
      <SpeedChart session={s} />
      {!vehicle && <Splits session={s} />}
      <Section title={t("events")}>
        <div className="card events">
          {s.events.length ? (
            s.events.map((e) => (
              <div key={e.id}>
                <AlertTriangle size={16} />
                <span>
                  {t(e.type === "over" ? "overEvent" : e.type)}
                  <small>
                    {duration(e.elapsed)} · {number(e.value, language)}{" "}
                    {t(e.type === "over" ? "speedUnit" : "accelerationUnit")}
                  </small>
                </span>
              </div>
            ))
          ) : (
            <p className="muted">{t("noEvents")}</p>
          )}
        </div>
      </Section>
      <Section title={t("route")}>
        <RouteMap
          measurements={s.measurements}
          mode={s.type}
          navigation={s.navigation}
        />
      </Section>
      <PhysicsPanel session={s} />
      {vehicle && <p className="footnote">{t("reference")}</p>}
      <button className="primary-button" onClick={onBack}>
        {t(summary ? "done" : "back")}
      </button>
    </>
  );
}
