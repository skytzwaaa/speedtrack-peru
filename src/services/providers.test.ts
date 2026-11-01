import { afterEach, describe, expect, it, vi } from "vitest";
import { trafficService } from "./trafficService";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("optional traffic", () => {
  it("does not request or fabricate traffic when unconfigured", async () => {
    vi.stubEnv("VITE_TRAFFIC_URL", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await trafficService.get([0, 0], [1, 1])).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("returns only fresh, valid provider data and drops malformed conditions", async () => {
    vi.stubEnv("VITE_TRAFFIC_URL", "https://example.test/traffic");
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        etaSeconds: 120,
        condition: "invented",
        incidents: ["Closure", 4],
        updatedAt: new Date().toISOString(),
      }),
    });
    vi.stubGlobal("fetch", fetch);
    expect(await trafficService.get([0, 0], [1, 1])).toMatchObject({
      etaSeconds: 120,
      condition: undefined,
      incidents: ["Closure"],
    });
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        etaSeconds: 120,
        updatedAt: "2000-01-01T00:00:00Z",
      }),
    });
    expect(await trafficService.get([0, 0], [1, 1])).toBeNull();
    fetch.mockRejectedValue(new Error("offline"));
    expect(await trafficService.get([0, 0], [1, 1])).toBeNull();
  });
});
it("routing without a key does not produce a false navigable straight line", async () => {
  vi.stubEnv("VITE_ROUTING_API_KEY", "");
  vi.resetModules();
  const { routingService } = await import("./routingService");
  await expect(routingService.route([0, 0], [1, 1], "walk")).rejects.toThrow(
    "routingUnavailable",
  );
});
