import { describe, it, expect } from "vitest";
import { GpsFilter, gpsPolicy } from "./gpsFilter";
const p = (
  seconds: number,
  meters: number,
  speed: number | null = null,
  accuracy = 5,
) => ({
  timestamp: seconds * 1000,
  latitude: 0,
  longitude: meters / 111194.9266,
  speed,
  accuracy,
});
describe("precision regression", () => {
  it("never sums coordinate noise, even with false device movement", () => {
    const f = new GpsFilter();
    f.accept(p(0, 0), "run");
    let distance = 0;
    for (let i = 1; i < 120; i++) {
      const result = f.accept(p(i, Math.sin(i) * 1.5, 1), "run");
      distance += result?.delta ?? 0;
      expect(result?.speed).toBe(0);
    }
    expect(distance).toBe(0);
  });
  it("rejects a sudden jump even after a long stationary anchor", () => {
    const f = new GpsFilter();
    f.accept(p(0, 0), "run");
    for (let i = 1; i < 120; i++) f.accept(p(i, 0.5), "run");
    expect(f.accept(p(120, 100), "run")).toBeNull();
  });
  it("accumulates slow movement against the anchor instead of discarding every step", () => {
    const f = new GpsFilter();
    f.accept(p(0, 0), "walk");
    let distance = 0;
    for (let i = 1; i <= 12; i++) distance += f.accept(p(i, i), "walk")!.delta;
    expect(distance).toBeCloseTo(0.012, 4);
  });
  it("does not flash a stopped pace between normal walking steps, but stops after bounded uncertainty", () => {
    const f = new GpsFilter();
    f.accept(p(0, 0), "walk");
    for (let i = 1; i <= 30; i++) f.accept(p(i, i), "walk");
    expect(f.accept(p(31, 31), "walk")!.speed).toBeGreaterThan(3);
    for (let i = 32; i <= 36; i++) f.accept(p(i, 31), "walk");
    expect(f.accept(p(37, 31), "walk")!.speed).toBe(0);
  });
  it("derives instantaneous v from displacement/time independently of device speed", () => {
    const f = new GpsFilter();
    f.accept(p(0, 0), "run");
    const r = f.accept(p(2, 6, 10), "run")!;
    expect(r.instantaneousSpeed).toBeCloseTo(10.8);
    expect(r.speed).toBeGreaterThan(0);
    expect(r.speed).toBeLessThan(r.instantaneousSpeed);
    expect(r.acceleration).toBeCloseTo(r.speed / 3.6 / 2);
  });
  it("rejects absurd acceleration before smoothing can hide it", () => {
    const f = new GpsFilter();
    f.accept(p(0, 0), "vehicle");
    expect(f.accept(p(1, 50, 50), "vehicle")).toBeNull();
    expect(f.accept(p(2, 6, 3), "vehicle")?.delta).toBeCloseTo(0.006);
  });
  it("quality policy is configurable and bad points cannot become baselines", () => {
    const f = new GpsFilter({ ...gpsPolicy, maxAccuracyM: 10 });
    f.accept(p(0, 0), "run");
    expect(f.accept(p(1, 200, null, 11), "run")).toBeNull();
    expect(f.accept(p(2, 6), "run")?.delta).toBeCloseTo(0.006);
  });
  it("pause/resume, gaps and mode switches reacquire without bridging distance", () => {
    const f = new GpsFilter();
    f.accept(p(0, 0), "run");
    f.accept(p(2, 6), "run");
    f.reset();
    expect(f.accept(p(3, 500), "run")).toMatchObject({
      delta: 0,
      speed: 0,
      breakBefore: true,
    });
    expect(f.accept(p(40, 1000), "run")).toMatchObject({
      delta: 0,
      acceleration: 0,
      breakBefore: true,
    });
    expect(f.accept(p(41, 1100), "bike")).toMatchObject({
      delta: 0,
      speed: 0,
      breakBefore: true,
    });
  });
});
