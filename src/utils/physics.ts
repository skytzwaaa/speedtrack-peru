import type { Measurement, Session, SpeedStatus, Split } from "../types";
// Public speed values are km/h, distances km, durations seconds, acceleration m/s².
export const calculateAverageSpeed = (distance: number, seconds: number) =>
  seconds > 0 ? (distance / seconds) * 3600 : 0;
export const calculateAcceleration = (
  previousSpeed: number,
  speed: number,
  seconds: number,
) => (seconds > 0 ? (speed - previousSpeed) / 3.6 / seconds : 0);
export const calculateDeceleration = (
  previousSpeed: number,
  speed: number,
  seconds: number,
) => Math.max(0, -calculateAcceleration(previousSpeed, speed, seconds));
export const calculatePace = (speed: number) => (speed > 0 ? 3600 / speed : 0);
export const calculateAveragePace = (distance: number, seconds: number) =>
  distance > 0 ? seconds / distance : 0;
export const calculateMaxSpeed = (measurements: Measurement[]) =>
  Math.max(0, ...measurements.map((m) => m.speed));
export const classifySpeedStatus = (
  speed: number,
  limit: number,
): SpeedStatus =>
  speed > limit ? "over" : speed >= limit * 0.9 ? "caution" : "normal";
export function calculateDistance(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude),
    dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function calculateSplit(
  measurements: Measurement[],
  sessionId: string,
): Split[] {
  const splits: Split[] = [];
  let previousCrossing = 0;
  for (let i = 1; i < measurements.length; i++) {
    const a = measurements[i - 1],
      b = measurements[i];
    for (let km = splits.length + 1; km <= Math.floor(b.distance); km++) {
      const fraction =
        b.distance > a.distance
          ? (km - a.distance) / (b.distance - a.distance)
          : 1;
      const crossing =
        a.elapsed +
        Math.max(0, Math.min(1, fraction)) * (b.elapsed - a.elapsed);
      const time = crossing - previousCrossing;
      splits.push({
        id: `${sessionId}-split-${km}`,
        session_id: sessionId,
        kilometer: km,
        time,
        pace: time,
      });
      previousCrossing = crossing;
    }
  }
  return splits;
}
export function addMeasurement(session: Session, m: Measurement): Session {
  const measurements = [...session.measurements, m];
  const previous = session.measurements.at(-1);
  const dt =
    previous && !m.break_before ? Math.max(0, m.elapsed - previous.elapsed) : 0;
  const events = [...session.events];
  const add = (type: "brake" | "accelerate" | "over", value: number) =>
    events.push({
      id: crypto.randomUUID(),
      session_id: session.id,
      timestamp: m.timestamp,
      elapsed: m.elapsed,
      type,
      value,
    });
  if (session.type === "vehicle") {
    if (m.acceleration <= -2.5 && (previous?.acceleration ?? 0) > -2.5)
      add("brake", -m.acceleration);
    if (m.acceleration >= 2.5 && (previous?.acceleration ?? 0) < 2.5)
      add("accelerate", m.acceleration);
    if (m.speed > session.limit && (previous?.speed ?? 0) <= session.limit)
      add("over", m.speed);
  }
  return {
    ...session,
    measurements,
    events,
    distance: m.distance,
    duration: m.elapsed,
    avg_speed: calculateAverageSpeed(m.distance, m.elapsed),
    max_speed: calculateMaxSpeed(measurements),
    max_acceleration: Math.max(session.max_acceleration, m.acceleration),
    max_deceleration: Math.max(session.max_deceleration, -m.acceleration),
    above_limit:
      session.above_limit + ((previous?.speed ?? 0) > session.limit ? dt : 0),
    splits: calculateSplit(measurements, session.id),
  };
}
