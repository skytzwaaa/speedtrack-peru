import { describe, it, expect } from "vitest";
import { GpsFilter } from "./gpsFilter";
import {
  kmhToMs,
  msToKmh,
  recentSpeed,
  routeProgress,
  userEta,
} from "./navigation";
import { navigationForMode, routingProfile } from "../services/routingService";
import { generateDemo } from "../data/demo";
const point = (
  timestamp: number,
  longitude = 0,
  speed: number | null = 0,
  accuracy = 5,
) => ({ timestamp, longitude, latitude: 0, speed, accuracy });
describe("GPS filtering", () => {
  it("rejects invalid coordinates, poor accuracy and reversed time", () => {
    const f = new GpsFilter();
    expect(f.accept(point(0, 0, 0, 200), "run")).toBeNull();
    expect(f.accept(point(1000), "run")).not.toBeNull();
    expect(f.accept(point(500), "run")).toBeNull();
    expect(f.accept(point(2000, 200), "run")).toBeNull();
    expect(f.accept(point(2000, NaN), "run")).toBeNull();
  });
  it("rejects jumps without poisoning the accepted baseline", () => {
    const f = new GpsFilter();
    f.accept(point(1000), "run");
    expect(f.accept(point(2000, 1, 3), "run")).toBeNull();
    const accepted = f.accept(point(3000, 0.00005, 3), "run");
    expect(accepted?.delta).toBeCloseTo(0.00556, 4);
    expect(accepted?.speed).toBeGreaterThan(0);
    expect(accepted?.speed).toBeLessThan(10.8);
  });
  it("does not count jitter while stationary or bridge a signal gap", () => {
    const f = new GpsFilter();
    f.accept(point(1000), "walk");
    expect(f.accept(point(2000, 0.00001), "walk")?.delta).toBe(0);
    expect(f.accept(point(30000, 0.002, 4), "walk")?.delta).toBe(0);
    f.reset();
    expect(f.accept(point(31000, 0.004, 4), "walk")?.speed).toBe(0);
  });
  it("rejects device speeds impossible for the activity", () => {
    const f = new GpsFilter();
    f.accept(point(1000), "walk");
    expect(f.accept(point(2000, 0.00001, 30), "walk")).toBeNull();
  });
});
describe("routing and dynamic ETA", () => {
  it("uses mode-specific profiles", () => {
    expect(routingProfile("walk")).toBe("foot-walking");
    expect(routingProfile("run")).toBe("foot-walking");
    expect(routingProfile("bike")).toBe("cycling-regular");
    expect(routingProfile("vehicle")).toBe("driving-car");
  });
  it("uses remaining route distance and rejects stopped/invalid speed", () => {
    expect(userEta(6, 18)).toBe(1200);
    expect(userEta(6, 0)).toBeNull();
    expect(userEta(-1, 10)).toBeNull();
    expect(userEta(0, 0)).toBe(0);
    expect(userEta(6, Infinity)).toBeNull();
    expect(msToKmh(kmhToMs(36))).toBeCloseTo(36);
  });
  it("projects on a segment and detects deviations", () => {
    const r = routeProgress(
      [0.005, 0],
      [
        [0, 0],
        [0.01, 0],
        [0.01, 0.01],
      ],
    );
    expect(r.remaining).toBeCloseTo(1.668, 2);
    expect(r.offRoute).toBe(false);
    expect(
      routeProgress(
        [1, 1],
        [
          [0, 0],
          [0.01, 0],
        ],
      ).offRoute,
    ).toBe(true);
  });
  it("waits for samples and expires the estimate after signal loss", () => {
    const m = generateDemo("vehicle").measurements.slice(0, 10);
    expect(recentSpeed(m.slice(0, 2), 1)).toBe(0);
    expect(recentSpeed(m, 9)).toBeGreaterThan(0);
    expect(recentSpeed(m, 30)).toBe(0);
  });
  it("requires fresh samples after a pause or GPS break", () => {
    const samples = generateDemo("vehicle")
      .measurements.slice(0, 6)
      .map((m, i) => ({
        ...m,
        elapsed: i,
        speed: i < 3 ? 100 : 5,
        break_before: i === 3,
      }));
    expect(recentSpeed(samples.slice(0, 4), 3)).toBe(0);
    expect(recentSpeed(samples.slice(0, 5), 4)).toBe(0);
    expect(recentSpeed(samples, 5)).toBe(5);
  });
});

it("mode change preserves destination but invalidates the incompatible route", () => {
  const destination: [number, number] = [1, 1];
  const plan = {
    destination,
    route: {
      coordinates: [[0, 0], destination] as [number, number][],
      profile: "cycling-regular",
      distance: 10,
      duration: 100,
    },
  };
  expect(navigationForMode(plan, "walk")).toEqual({
    destination,
    route: undefined,
  });
  expect(navigationForMode(plan, "bike")?.route).toBe(plan.route);
  expect(navigationForMode(undefined, "vehicle")).toBeUndefined();
});
it("remaining geometry starts at projection and malformed routes have no ETA", () => {
  expect(
    routeProgress(
      [0.005, 0],
      [
        [0, 0],
        [0.01, 0],
      ],
    ).remainingCoordinates,
  ).toEqual([
    [0.005, 0],
    [0.01, 0],
  ]);
  expect(routeProgress([0, 0], [])).toMatchObject({
    offRoute: true,
    remainingCoordinates: [],
  });
});
