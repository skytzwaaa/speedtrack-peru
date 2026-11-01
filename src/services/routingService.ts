import type {
  ActivityType,
  Coordinate,
  RoutePlan,
  NavigationPlan,
} from "../types";
import { providerFetch } from "./request";
export const routingProfile = (mode: ActivityType) =>
  mode === "vehicle"
    ? "driving-car"
    : mode === "bike"
      ? "cycling-regular"
      : "foot-walking";
export function navigationForMode(
  plan: NavigationPlan | undefined,
  mode: ActivityType,
): NavigationPlan | undefined {
  return plan
    ? {
        ...plan,
        route:
          plan.route?.profile === routingProfile(mode) ? plan.route : undefined,
      }
    : undefined;
}
export interface RoutingProvider {
  route(
    from: Coordinate,
    to: Coordinate,
    mode: ActivityType,
    signal?: AbortSignal,
  ): Promise<RoutePlan>;
}
export const routingAvailable = !!import.meta.env.VITE_ROUTING_API_KEY;
export const routingService: RoutingProvider = {
  async route(from, to, mode, signal) {
    if (!routingAvailable) throw new Error("routingUnavailable");
    const profile = routingProfile(mode);
    const base =
      import.meta.env.VITE_ROUTING_URL || "https://api.heigit.org/openrouteservice";
    const response = await providerFetch(
      `${base}/v2/directions/${profile}/geojson`,
      {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: import.meta.env.VITE_ROUTING_API_KEY,
        },
        body: JSON.stringify({ coordinates: [from, to] }),
      },
    );
    if (!response.ok) throw new Error("routeError");
    const data = await response.json();
    const feature = data.features?.[0];
    const coordinates: Coordinate[] = feature?.geometry?.coordinates;
    const summary = feature?.properties?.summary;
    if (
      !Array.isArray(coordinates) ||
      coordinates.length < 2 ||
      !coordinates.every(validCoordinate) ||
      !Number.isFinite(summary?.distance) ||
      summary.distance < 0 ||
      !Number.isFinite(summary?.duration) ||
      summary.duration < 0
    )
      throw new Error("routeError");
    return {
      coordinates,
      distance: summary.distance / 1000,
      duration: summary.duration,
      profile,
    };
  },
};
export function validCoordinate(c: unknown): c is Coordinate {
  return (
    Array.isArray(c) &&
    c.length >= 2 &&
    Number.isFinite(c[0]) &&
    Number.isFinite(c[1]) &&
    Math.abs(c[0]) <= 180 &&
    Math.abs(c[1]) <= 90
  );
}
export async function searchDestinations(
  query: string,
  signal?: AbortSignal,
): Promise<{ name: string; coordinate: Coordinate }[]> {
  if (!routingAvailable || query.trim().length < 3) return [];
  const base =
    import.meta.env.VITE_ROUTING_URL || "https://api.heigit.org/openrouteservice";
  const response = await providerFetch(
    `${base}/geocode/search?text=${encodeURIComponent(query)}&size=5`,
    {
      signal,
      headers: { Authorization: import.meta.env.VITE_ROUTING_API_KEY },
    },
  );
  if (!response.ok) throw new Error("searchError");
  const data = await response.json();
  return (data.features ?? [])
    .filter((f: { geometry: { coordinates: unknown } }) =>
      validCoordinate(f.geometry?.coordinates),
    )
    .map(
      (f: {
        geometry: { coordinates: Coordinate };
        properties: { label: string };
      }) => ({ name: f.properties.label, coordinate: f.geometry.coordinates }),
    );
}
