import { gpsPolicy } from "../utils/gpsFilter";
import { useState } from "react";
import {
  Bike,
  Footprints,
  Activity,
  Play,
  Pause,
  Square,
  ShieldCheck,
  Radio,
  Navigation,
} from "lucide-react";
import type { ActivityType, Session, Settings, NavigationPlan } from "../types";
import { useI18n } from "../i18n";
import { PageHeading, Metric, Section, Toggle } from "../components/ui";
import { SpeedChart } from "../components/SpeedChart";
import { RouteMap } from "../components/RouteMap";
import { Splits } from "../components/Splits";
import { PhysicsPanel } from "../components/PhysicsPanel";
import {
  calculateAveragePace,
  calculatePace,
  classifySpeedStatus,
} from "../utils/physics";
import { duration, number, pace } from "../utils/formatters";
interface Props {
  blockedStart?: boolean;
  vehicle: boolean;
  session: Session | null;
  paused: boolean;
  gpsError: boolean;
  waitingFix?: boolean;
  motion: { supported: boolean; moving: boolean; steps: number };
  gpsAccuracy?: number | null;
  settings: Settings;
  setLimit: (v: number) => void;
  start: (
    type: ActivityType,
    demo: boolean,
    goal: number | null,
    navigation?: NavigationPlan,
  ) => void;
  updateNavigation: (plan: NavigationPlan | undefined) => void;
  finish: () => void;
  togglePause: () => void;
}
export function TrackerPage({
  blockedStart,
  vehicle,
  session,
  paused,
  gpsError,
  gpsAccuracy,
  waitingFix,
  motion,
  settings,
  setLimit,
  start,
  updateNavigation,
  finish,
  togglePause,
}: Props) {
  const { t, language } = useI18n();
  const [type, setType] = useState<ActivityType>("run"),
    [demo, setDemo] = useState(false),
    [goal, setGoal] = useState("");
  const [navigation, setNavigation] = useState<NavigationPlan>();
  const s =
    session && (session.type === "vehicle") === vehicle ? session : null;
  const current = s?.measurements.at(-1),
    stale = !s?.demo && !!current && (s?.duration ?? 0) - current.elapsed > 10,
    speed = paused || stale || waitingFix ? 0 : (current?.speed ?? 0),
    status = classifySpeedStatus(speed, s?.limit ?? settings.speed_limit);
  const cycling = (s?.type ?? type) === "bike";
  const onFoot = s?.type === "walk" || s?.type === "run";
  // Longitud de paso media: heurística, no una medición.
  const stride = s?.type === "run" ? 1.0 : 0.72;
  return (
    <div className={s ? `live-activity mode-${s.type}` : undefined}>
      <PageHeading
        eyebrow={t(s ? s.type : vehicle ? "vehicle" : "physical")}
        title={t(s ? (paused ? "paused" : "active") : "prepare")}
      >
        {!s && <p>{t(vehicle ? "vehicleDesc" : "physicalDesc")}</p>}
      </PageHeading>
      {vehicle && !s && (
        <div className="driving-notice">
          <ShieldCheck size={20} />
          <p>{t("driving")}</p>
        </div>
      )}
      {!s ? (
        <>
          <div className="card setup-card">
            {!vehicle && (
              <>
                <label className="field-label">{t("activityType")}</label>
                <div className="activity-picker">
                  {(
                    [
                      { key: "walk", Icon: Footprints },
                      { key: "run", Icon: Activity },
                      { key: "bike", Icon: Bike },
                    ] as const
                  ).map(({ key, Icon }) => (
                    <button
                      key={key}
                      className={type === key ? "selected" : ""}
                      onClick={() => setType(key)}
                      aria-pressed={type === key}
                    >
                      <Icon size={23} />
                      {t(key)}
                    </button>
                  ))}
                </div>
                <label className="field-label" htmlFor="goal">
                  {t("goal")}
                </label>
                <div className="input-unit">
                  <input
                    id="goal"
                    type="number"
                    min="0.1"
                    max="500"
                    step="0.1"
                    placeholder={t("noGoal")}
                    aria-label={t("goalUnit")}
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                  />
                  <span>{t("distanceUnit")}</span>
                </div>
              </>
            )}
            {vehicle && (
              <label className="field-label" htmlFor="limit">
                {t("limit")}
                <div className="input-unit">
                  <input
                    id="limit"
                    type="number"
                    min="10"
                    max="130"
                    step="5"
                    value={settings.speed_limit}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (v >= 10 && v <= 130) setLimit(v);
                    }}
                  />
                  <span>{t("speedUnit")}</span>
                </div>
              </label>
            )}
            <Toggle label={t("demo")} checked={demo} onChange={setDemo} />
            <div className="notice">
              <Radio size={16} />
              <p>{t(demo ? "demoInfo" : "gpsInfo")}</p>
            </div>
            <button
              className="primary-button"
              onClick={() =>
                start(
                  vehicle ? "vehicle" : type,
                  demo,
                  goal && Number(goal) > 0 && Number(goal) <= 500
                    ? Number(goal)
                    : null,
                  navigation,
                )
              }
              disabled={!!session || blockedStart}
            >
              <Play size={19} fill="currentColor" />
              {t(vehicle ? "startVehicle" : "startActivity")}
            </button>
            {session && <p className="muted">{t("sessionActive")}</p>}
          </div>
          <Section title={t("destination")}>
            <RouteMap
              measurements={[]}
              mode={vehicle ? "vehicle" : type}
              navigation={navigation}
              onNavigation={setNavigation}
            />
          </Section>
          <div className="preview-orbit">
            <Navigation size={32} />
            <span>
              {t(demo ? (vehicle ? "demoVehicle" : "demoSport") : "realGps")}
            </span>
            <small>{t(demo ? "endDemo" : "gpsInfo")}</small>
          </div>
        </>
      ) : (
        <>
          <div className="tracker-status">
            <span className={`pill ${paused ? "paused-pill" : ""}`}>
              <span className="live-dot" />
              {t(s.demo ? "simulated" : "realGps")}
            </span>
            <span>
              {t(s.demo ? "simulatedTime" : "time")} {duration(s.duration)}
            </span>
          </div>
          {stale && <p className="notice">{t("gpsLost")}</p>}
          {s && !s.demo && motion.supported && (
            <p className="muted">
              {t("motionSensor")}:{" "}
              {t(motion.moving ? "motionMoving" : "motionStill")}
              {onFoot && (
                <>
                  {" · "}
                  {t("steps")} {motion.steps} ·{" "}
                  {t("stepsEstimate", {
                    value: Math.round(motion.steps * stride),
                  })}
                </>
              )}
            </p>
          )}
          {s &&
            !s.demo &&
            motion.supported &&
            motion.moving &&
            (stale || waitingFix) && (
              <p className="notice" role="status">
                {t("motionNoGps")}
              </p>
            )}
          {(gpsAccuracy ?? current?.accuracy) != null && (
            <p className="muted">
              {t("accuracy")}: ±{" "}
              {Math.round(gpsAccuracy ?? current?.accuracy ?? 0)} {t("meter")}
            </p>
          )}
          {gpsAccuracy != null && gpsAccuracy > gpsPolicy.maxAccuracyM && (
            <p className="notice" role="status">
              {t("lowAccuracyVoice")}
            </p>
          )}
          {gpsError && (
            <div className="error-message" role="alert">
              <p>{t("locationUnavailable")}</p>
            </div>
          )}
          {!s.demo && !s.measurements.length && !gpsError && (
            <p className="notice" role="status">
              {t("gpsWaiting")}
            </p>
          )}
          <div className="activity-map">
            {!vehicle && (
              <div className="live-summary sport-summary card">
                <div className="primary-metric">
                  <Metric
                    label={t(cycling ? "speed" : "pace")}
                    value={
                      cycling
                        ? number(speed, language, 1)
                        : pace(calculatePace(speed))
                    }
                    unit={t(cycling ? "speedUnit" : "paceUnit")}
                    accent
                  />
                </div>
                <Metric
                  label={t("distance")}
                  value={number(s.distance, language, 2)}
                  unit={t("distanceUnit")}
                />
                <Metric label={t("time")} value={duration(s.duration)} />
                {!cycling && (
                  <div className="secondary-speed">
                    {t("speed")} · {number(speed, language)} {t("speedUnit")}
                  </div>
                )}
              </div>
            )}
            <RouteMap
              active
              measurements={s.measurements}
              mode={s.type}
              elapsed={s.duration}
              paused={paused || waitingFix}
              navigation={s.navigation}
              onNavigation={updateNavigation}
              controls={(recenter) => (
                <>
                  {vehicle && (
                    <div className="live-summary vehicle-summary">
                      <Metric
                        label={t("speed")}
                        value={number(speed, language, 0)}
                        unit={t("speedUnit")}
                        accent
                      />
                    </div>
                  )}
                  <div className="session-controls">
                    <button className="secondary-button" onClick={togglePause}>
                      {paused ? <Play size={17} /> : <Pause size={17} />}
                      {t(paused ? "resume" : "pause")}
                    </button>
                    <button className="finish-button" onClick={finish}>
                      <Square size={15} fill="currentColor" />
                      {t("finish")}
                    </button>
                    {recenter}
                  </div>
                </>
              )}
            />
          </div>
          <details className="activity-details">
            <summary>{t("statistics")}</summary>
            {vehicle ? (
              <>
                <div
                  className={`speedometer ${status}`}
                  role="img"
                  aria-label={`${t("speed")} ${Math.round(speed)} ${t("speedUnit")}`}
                >
                  <div
                    className="speedometer-ring"
                    style={{
                      background: `conic-gradient(from 225deg,var(--gauge) 0deg ${Math.min(270, (speed / 130) * 270)}deg,#30372f ${Math.min(270, (speed / 130) * 270)}deg 270deg,transparent 270deg 360deg)`,
                    }}
                  />
                  <div className="gauge-labels">
                    <span>0</span>
                    <span>130</span>
                  </div>
                  <div className="speedometer-value">
                    <span>{t("speed")}</span>
                    <strong>{number(speed, language, 0)}</strong>
                    <small>{t("speedUnit")}</small>
                  </div>
                </div>
                <div className={`speed-state ${status}`}>
                  <span>{t(status)}</span>
                  <strong>
                    {t("limit")}: {s.limit} {t("speedUnit")}
                  </strong>
                  <p>
                    {t(speed > s.limit ? "above" : "below", {
                      value: number(Math.abs(s.limit - speed), language, 0),
                    })}
                  </p>
                </div>
                <div className="speed-scale">
                  <span>0</span>
                  <span>30</span>
                  <span>{s.limit}</span>
                  <span>130</span>
                  <i
                    style={{ left: `${Math.min(100, (speed / 130) * 100)}%` }}
                  />
                </div>
                <p className="footnote">{t("reference")}</p>
              </>
            ) : (
              <div className="pace-hero">
                <span>{t(cycling ? "speed" : "pace")}</span>
                <strong>
                  {cycling
                    ? number(speed, language)
                    : pace(calculatePace(speed))}
                </strong>
                <small>{t(cycling ? "speedUnit" : "paceUnit")}</small>
                <div>
                  <Navigation size={15} />
                  {number(s.distance, language, 2)} {t("distanceUnit")}
                </div>
              </div>
            )}
            <div className="metric-grid card">
              <Metric
                label={t("instantaneousSpeed")}
                value={number(
                  paused || stale || waitingFix
                    ? 0
                    : (current?.instantaneous_speed ?? speed),
                  language,
                )}
                unit={t("speedUnit")}
              />
              <Metric label={t("time")} value={duration(s.duration)} />
              <Metric
                label={t("distance")}
                value={number(s.distance, language, 2)}
                unit={t("distanceUnit")}
                accent
              />
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
                label={t("acceleration")}
                value={number(current?.acceleration ?? 0, language, 2)}
                unit={t("accelerationUnit")}
              />
              <Metric
                label={t("maxAcceleration")}
                value={number(s.max_acceleration, language, 2)}
                unit={t("accelerationUnit")}
              />
              {vehicle ? (
                <>
                  <Metric
                    label={t("deceleration")}
                    value={number(
                      Math.max(0, -(current?.acceleration ?? 0)),
                      language,
                      2,
                    )}
                    unit={t("accelerationUnit")}
                  />
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
                    value={
                      s.events.filter((e) => e.type === "accelerate").length
                    }
                  />
                  <Metric
                    label={t("aboveTime")}
                    value={duration(s.above_limit)}
                  />
                </>
              ) : (
                <>
                  <Metric
                    label={t("speed")}
                    value={number(speed, language)}
                    unit={t("speedUnit")}
                  />
                  <Metric
                    label={t("avgPace")}
                    value={pace(calculateAveragePace(s.distance, s.duration))}
                    unit={t("paceUnit")}
                  />
                </>
              )}
            </div>
            {!vehicle && (
              <>
                <Section
                  title={t("progress")}
                  action={
                    <span className="tiny-unit">
                      {t("km")} {Math.floor(s.distance) + 1}
                    </span>
                  }
                >
                  <div className="progress-track">
                    <i style={{ width: `${(s.distance % 1) * 100}%` }} />
                  </div>
                  {s.goal && (
                    <p className="muted">
                      {s.distance >= s.goal
                        ? t("goalReached")
                        : `${number(s.distance, language, 2)} / ${s.goal} ${t("distanceUnit")}`}
                    </p>
                  )}
                </Section>
                <Splits session={s} />
              </>
            )}
            <SpeedChart session={s} />
            <PhysicsPanel session={s} />
          </details>
        </>
      )}
    </div>
  );
}
