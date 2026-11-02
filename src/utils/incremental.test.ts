import { expect, it } from "vitest";
import { fixtureSession } from "../test/fixtures";
import { calculateSplit } from "./physics";
import { thin } from "../services/draftService";
it("incremental splits match a full recalculation", () => {
  for (const type of ["run", "bike", "walk"] as const) {
    const s = fixtureSession(type);
    expect(s.splits).toEqual(calculateSplit(s.measurements, s.id));
  }
});
it("draft thinning keeps first, last and breaks while bounding size", () => {
  const s = fixtureSession("run");
  const many = Array.from({ length: 7200 }, (_, i) => ({
    ...s.measurements[1],
    id: `m${i}`,
    break_before: i === 3001,
  }));
  const t = thin({ ...s, measurements: many });
  expect(t.measurements.length).toBeLessThanOrEqual(2003);
  expect(t.measurements[0].id).toBe("m0");
  expect(t.measurements.at(-1)?.id).toBe("m7199");
  expect(t.measurements.some((m) => m.id === "m3001")).toBe(true);
  expect(thin(s)).toBe(s);
});
