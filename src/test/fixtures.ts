// Datos sintéticos SOLO para pruebas automáticas. La app no los importa.
import type { ActivityType, Session } from "../types";
import { addMeasurement, calculateAcceleration } from "../utils/physics";
import { newSession } from "../utils/session";
export const DEMO_SECONDS = 45;
export const demoScale = (type: ActivityType) => (type === "vehicle" ? 1 : 40);
export function demoSpeed(type: ActivityType, second: number) {
  if (type === "vehicle") {
    const points = [
      [0, 0],
      [3, 5],
      [5, 24],
      [9, 38],
      [14, 45],
      [18, 45],
      [22, 54],
      [26, 58],
      [29, 58],
      [30, 44],
      [33, 40],
      [37, 24],
      [42, 7],
      [45, 0],
    ];
    const index = points.findIndex((p) => p[0] >= second);
    if (index <= 0) return 0;
    const a = points[index - 1],
      b = points[index];
    return a[1] + ((b[1] - a[1]) * (second - a[0])) / (b[0] - a[0]);
  }
  const base = type === "walk" ? 5.2 : type === "bike" ? 23 : 11.5;
  const ramp = Math.min(1, second / 4, (45 - second) / 4);
  return Math.max(0, (base + Math.sin(second * 0.7) * 0.6) * ramp);
}
export function demoMeasurement(session: Session, second: number) {
  const previous = session.measurements.at(-1);
  const elapsed = second * demoScale(session.type),
    dt = elapsed - (previous?.elapsed ?? 0),
    speed = demoSpeed(session.type, second);
  const distance =
    session.distance + ((((previous?.speed ?? 0) + speed) / 2) * dt) / 3600;
  return {
    id: crypto.randomUUID(),
    session_id: session.id,
    timestamp: new Date(session.start_time).getTime() + elapsed * 1000,
    elapsed,
    latitude: -12.12 + distance * 0.004,
    longitude: -77.03 + Math.sin(distance * 2) * 0.002,
    speed,
    acceleration: calculateAcceleration(previous?.speed ?? 0, speed, dt),
    accuracy: null,
    distance,
  };
}
export function fixtureSession(type: ActivityType) {
  let s = newSession(type, 50, null);
  for (let i = 0; i <= 45; i++) s = addMeasurement(s, demoMeasurement(s, i));
  return { ...s, end_time: new Date().toISOString() };
}
