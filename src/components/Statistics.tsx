import type { Session } from "../types";
import { useI18n } from "../i18n";
import { duration, number, pace } from "../utils/formatters";
import { calculateAveragePace, calculateAverageSpeed } from "../utils/physics";
import { Metric, Section } from "./ui";
export function Statistics({ sessions }: { sessions: Session[] }) {
  const { t, language } = useI18n();
  const real = sessions.filter((s) => !s.demo);
  const distance = real.reduce((a, s) => a + s.distance, 0),
    time = real.reduce((a, s) => a + s.duration, 0);
  const foot = real.filter((s) => s.type === "walk" || s.type === "run");
  const now = new Date(),
    month = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthly = real.filter(
    (s) => new Date(s.start_time) >= month && new Date(s.start_time) <= now,
  );
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6 + i,
    );
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    return {
      label: t(
        (
          [
            "weekday0",
            "weekday1",
            "weekday2",
            "weekday3",
            "weekday4",
            "weekday5",
            "weekday6",
          ] as const
        )[date.getDay()],
      ),
      km: real
        .filter(
          (s) => new Date(s.start_time) >= date && new Date(s.start_time) < end,
        )
        .reduce((a, s) => a + s.distance, 0),
    };
  });
  const max = days.reduce((m, d) => Math.max(m, d.km), 1);
  return (
    <Section title={t("statistics")}>
      <p className="muted">{t("realOnly")}</p>
      <div className="metric-grid card">
        <Metric
          label={t("distance")}
          value={number(distance, language, 2)}
          unit={t("distanceUnit")}
        />
        <Metric label={t("time")} value={duration(time)} />
        <Metric label={t("sessions")} value={real.length} />
        <Metric
          label={t("avgSpeed")}
          value={number(calculateAverageSpeed(distance, time), language)}
          unit={t("speedUnit")}
        />
        <Metric
          label={t("maxSpeed")}
          value={number(
            real.reduce((m, s) => Math.max(m, s.max_speed), 0),
            language,
          )}
          unit={t("speedUnit")}
        />
        <Metric
          label={t("avgPace")}
          value={pace(
            calculateAveragePace(
              foot.reduce((a, s) => a + s.distance, 0),
              foot.reduce((a, s) => a + s.duration, 0),
            ),
          )}
          unit={t("paceUnit")}
        />
        <Metric
          label={t("monthly")}
          value={number(
            monthly.reduce((a, s) => a + s.distance, 0),
            language,
            2,
          )}
          unit={t("distanceUnit")}
        />
      </div>
      <div className="weekly-bars card" aria-label={t("weekly")}>
        {days.map((d, i) => (
          <div key={i}>
            <small>{number(d.km, language, 1)}</small>
            <div className="bar-space">
              <i style={{ height: `${(d.km / max) * 100}%` }} />
            </div>
            <span>{d.label}</span>
          </div>
        ))}
      </div>
      <div className="activity-counts">
        {(["walk", "run", "bike", "vehicle"] as const).map((type) => (
          <span key={type}>
            {t(type)} <b>{real.filter((s) => s.type === type).length}</b>
          </span>
        ))}
      </div>
    </Section>
  );
}
