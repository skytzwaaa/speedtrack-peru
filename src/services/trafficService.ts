import type { Coordinate } from "../types";
import { providerFetch } from "./request";
export interface TrafficReport {
  etaSeconds: number;
  condition?: "flow" | "moderate" | "congested";
  incidents?: string[];
  updatedAt: string;
}
export interface TrafficProvider {
  get(
    from: Coordinate,
    to: Coordinate,
    signal?: AbortSignal,
  ): Promise<TrafficReport | null>;
}
// Optional server proxy: provider secrets never need to be in the web bundle.
export const trafficService: TrafficProvider = {
  async get(from, to, signal) {
    const url = import.meta.env.VITE_TRAFFIC_URL;
    if (!url) return null;
    try {
      const response = await providerFetch(url, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      if (!response.ok) return null;
      const report = await response.json();
      if (
        !Number.isFinite(report.etaSeconds) ||
        report.etaSeconds < 0 ||
        !Number.isFinite(Date.parse(report.updatedAt)) ||
        Math.abs(Date.now() - Date.parse(report.updatedAt)) > 300000
      )
        return null;
      return {
        etaSeconds: report.etaSeconds,
        updatedAt: report.updatedAt,
        condition: ["flow", "moderate", "congested"].includes(report.condition)
          ? report.condition
          : undefined,
        incidents: Array.isArray(report.incidents)
          ? report.incidents
              .filter((x: unknown) => typeof x === "string")
              .slice(0, 20)
          : undefined,
      };
    } catch {
      return null;
    }
  },
};
