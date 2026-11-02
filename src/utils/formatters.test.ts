import { expect, it } from "vitest";
import { duration, pace } from "./formatters";
it("duration shows hours after 59:59 and clamps negatives", () => {
  expect(duration(0)).toBe("00:00");
  expect(duration(3599)).toBe("59:59");
  expect(duration(3600)).toBe("1:00:00");
  expect(duration(20712)).toBe("5:45:12");
  expect(duration(-5)).toBe("00:00");
});
it("pace stays mm:ss and handles zero", () => {
  expect(pace(305)).toBe("05:05");
  expect(pace(0)).toBe("—");
});
