import { describe, expect, it } from "vitest";
import { MotionAnalyzer } from "./motionService";
// Generador pseudoaleatorio con semilla para pruebas reproducibles.
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296 - 0.5;
};
const run = (
  seconds: number,
  fn: (t: number) => number,
  hz = 50,
): MotionAnalyzer & { last: boolean } => {
  const a = new MotionAnalyzer();
  let moving = false;
  for (let i = 0; i < seconds * hz; i++) {
    const t = (i * 1000) / hz;
    moving = a.push(t, 0, 0, 9.81 + fn(t / 1000)).moving;
  }
  return Object.assign(a, { last: moving });
};
describe("motion sensor", () => {
  it("counts ~2 steps/s while walking and reports movement", () => {
    const a = run(30, (t) => 2.5 * Math.sin(2 * Math.PI * 2 * t));
    expect(a.steps).toBeGreaterThanOrEqual(56);
    expect(a.steps).toBeLessThanOrEqual(62);
    expect(a.last).toBe(true);
  });
  it("counts running cadence (~3 steps/s)", () => {
    const a = run(20, (t) => 6 * Math.sin(2 * Math.PI * 3 * t));
    expect(a.steps).toBeGreaterThanOrEqual(56);
    expect(a.steps).toBeLessThanOrEqual(62);
  });
  it("a phone resting on a table has no steps and is still", () => {
    const r = rng(1);
    const a = run(30, () => r() * 0.04);
    expect(a.steps).toBe(0);
    expect(a.last).toBe(false);
  });
  it("vehicle vibration is movement without creating many steps", () => {
    const r = rng(7);
    const a = run(30, () => r() * 1.8);
    expect(a.last).toBe(true);
    expect(a.steps).toBeLessThan(15);
  });
  it("does not declare movement from the first few samples", () => {
    const a = new MotionAnalyzer();
    expect(a.push(0, 0, 0, 9.81).moving).toBe(false);
    expect(a.push(20, 0, 0, 14).moving).toBe(false);
  });
});
