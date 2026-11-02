import { describe, it, expect } from "vitest";
import {
  calculateAcceleration,
  calculateAveragePace,
  calculateAverageSpeed,
  calculateDeceleration,
  calculateDistance,
  calculatePace,
  classifySpeedStatus,
} from "./physics";
import { fixtureSession } from "../test/fixtures";
import { dictionaries } from "../i18n";
describe("kinematics and sessions", () => {
  it("uses compatible units and guards zero division", () => {
    expect(calculateAverageSpeed(5, 1800)).toBe(10);
    expect(calculateAcceleration(0, 36, 10)).toBe(1);
    expect(calculateDeceleration(36, 0, 2)).toBe(5);
    expect(calculatePace(12)).toBe(300);
    expect(calculateAveragePace(5, 1500)).toBe(300);
    expect(calculatePace(0)).toBe(0);
    expect(calculateAverageSpeed(1, 0)).toBe(0);
  });
  it("calculates geographic distance", () => {
    expect(
      calculateDistance(
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 1 },
      ),
    ).toBeCloseTo(111.195, 2);
  });
  it("classifies the configured limit", () => {
    expect(classifySpeedStatus(43, 50)).toBe("normal");
    expect(classifySpeedStatus(45, 50)).toBe("caution");
    expect(classifySpeedStatus(50, 50)).toBe("caution");
    expect(classifySpeedStatus(51, 50)).toBe("over");
  });
  it("sports demo integrates speed and interpolates full splits", () => {
    const s = fixtureSession("run");
    expect(s.duration).toBe(1800);
    expect(s.distance).toBeGreaterThan(4);
    expect(s.splits.length).toBe(Math.floor(s.distance));
    expect(s.splits[0].pace).toBeGreaterThan(250);
    expect(s.splits[0].pace).toBeLessThan(400);
    expect(s.avg_speed).toBeCloseTo(s.distance * 2);
    expect(s.measurements.at(-1)?.speed).toBe(0);
  });
  it("vehicle demo includes acceleration braking and overspeed", () => {
    const s = fixtureSession("vehicle");
    expect(s.duration).toBe(45);
    expect(s.events.some((e) => e.type === "accelerate")).toBe(true);
    expect(s.events.some((e) => e.type === "brake")).toBe(true);
    expect(s.events.some((e) => e.type === "over")).toBe(true);
    expect(s.above_limit).toBeGreaterThan(0);
    expect(s.max_speed).toBe(58);
    expect(s.max_deceleration).toBeGreaterThan(2.5);
  });
  it("English has every Spanish key", () => {
    expect(Object.keys(dictionaries.en).sort()).toEqual(
      Object.keys(dictionaries.es).sort(),
    );
  });
});
