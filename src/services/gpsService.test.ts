import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  requestPermissions: vi.fn(),
  watchPosition: vi.fn(),
  clearWatch: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
}));
vi.mock("@capacitor/geolocation", () => ({ Geolocation: api }));
import { watchGps } from "./gpsService";
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
beforeEach(() => {
  api.requestPermissions.mockResolvedValue({ location: "granted" });
  api.watchPosition.mockResolvedValue("native-watch");
  api.clearWatch.mockResolvedValue(undefined);
});
afterEach(() => vi.resetAllMocks());
it("native high accuracy uses a one-second desired interval independently of timeout", async () => {
  const error = vi.fn();
  const stop = watchGps(vi.fn(), error);
  await flush();
  expect(api.watchPosition).toHaveBeenCalledWith(
    expect.objectContaining({
      enableHighAccuracy: true,
      maximumAge: 0,
      interval: 1000,
      minimumUpdateInterval: 1000,
      timeout: 12000,
    }),
    expect.any(Function),
  );
  stop();
  expect(api.clearWatch).toHaveBeenCalledWith({ id: "native-watch" });
  expect(error).not.toHaveBeenCalled();
});
it("unmount while permissions are pending never starts a native watcher", async () => {
  let permit!: (value: { location: string }) => void;
  api.requestPermissions.mockImplementation(
    () =>
      new Promise((resolve) => {
        permit = resolve;
      }),
  );
  const stop = watchGps(vi.fn(), vi.fn());
  stop();
  permit({ location: "granted" });
  await flush();
  expect(api.watchPosition).not.toHaveBeenCalled();
});
it("denied native permissions report failure without crashing", async () => {
  api.requestPermissions.mockResolvedValue({
    location: "denied",
    coarseLocation: "denied",
  });
  const error = vi.fn();
  watchGps(vi.fn(), error);
  await flush();
  expect(error).toHaveBeenCalledOnce();
  expect(api.watchPosition).not.toHaveBeenCalled();
});
it("approximate-only permission warns but keeps watching", async () => {
  api.requestPermissions.mockResolvedValue({
    location: "prompt",
    coarseLocation: "granted",
  });
  const error = vi.fn();
  watchGps(vi.fn(), error);
  await flush();
  expect(error).toHaveBeenCalledOnce();
  expect(api.watchPosition).toHaveBeenCalledOnce();
});
