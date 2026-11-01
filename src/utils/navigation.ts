import type { Coordinate, Measurement } from "../types";
import { calculateDistance } from "./physics";
export const kmhToMs = (n: number) => n / 3.6;
export const msToKmh = (n: number) => n * 3.6;
export function userEta(distanceKm: number, speedKmh: number): number | null {
  if (
    !Number.isFinite(distanceKm) ||
    distanceKm < 0 ||
    !Number.isFinite(speedKmh)
  )
    return null;
  if (distanceKm === 0) return 0;
  return speedKmh >= 1 ? (distanceKm / speedKmh) * 3600 : null;
}
export function recentSpeed(measurements: Measurement[], elapsed: number) {
  const last = measurements.at(-1);
  if (!last || elapsed - last.elapsed > 10 || last.speed < 0.7) return 0;
  const samples: Measurement[] = [];
  for (let i = measurements.length - 1; i >= 0; i--) {
    const m = measurements[i];
    if (elapsed - m.elapsed > 20) break;
    if (m.elapsed <= elapsed) samples.push(m);
    // A pause or GPS reacquisition starts a new velocity window.
    if (m.break_before) break;
  }
  return samples.length >= 3
    ? samples.reduce((a, m) => a + m.speed, 0) / samples.length
    : 0;
}
const distance = (a: Coordinate, b: Coordinate) =>
  calculateDistance(
    { latitude: a[1], longitude: a[0] },
    { latitude: b[1], longitude: b[0] },
  );
// Project onto each segment, then sum the remaining polyline. No straight-line ETA.
export function routeProgress(position: Coordinate, coordinates: Coordinate[]) {
  let nearest = Infinity,
    index = 0,
    projection: Coordinate = coordinates[0];
  const cos = Math.cos((position[1] * Math.PI) / 180);
  for (let i = 0; i < coordinates.length - 1; i++) {
    const a = coordinates[i],
      b = coordinates[i + 1];
    const dx = (b[0] - a[0]) * cos,
      dy = b[1] - a[1];
    const f = Math.max(
      0,
      Math.min(
        1,
        ((position[0] - a[0]) * cos * dx + (position[1] - a[1]) * dy) /
          (dx * dx + dy * dy || 1),
      ),
    );
    const p: Coordinate = [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])];
    const d = distance(position, p);
    if (d < nearest) {
      nearest = d;
      index = i;
      projection = p;
    }
  }
  if (coordinates.length < 2)
    return {
      remaining: 0,
      offRoute: true,
      remainingCoordinates: [] as Coordinate[],
    };
  let remaining = distance(projection, coordinates[index + 1]);
  for (let i = index + 1; i < coordinates.length - 1; i++)
    remaining += distance(coordinates[i], coordinates[i + 1]);
  return {
    remaining,
    offRoute: nearest > 0.1,
    remainingCoordinates: [projection, ...coordinates.slice(index + 1)],
  };
}
