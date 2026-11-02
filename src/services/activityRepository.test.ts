import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enqueue,
  mergeSessions,
  pendingSessions,
  validSession,
  synchronize,
  importActivity,
} from "./activityRepository";
import { storageService } from "./storageService";
import { fixtureSession } from "../test/fixtures";
const mock = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("./supabase", () => ({ supabase: mock }));
describe("private offline history", () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
      removeItem: (k: string) => data.delete(k),
    });
    mock.rpc.mockReset();
    mock.from.mockReset();
  });
  it("keeps accounts and the V1 guest history separate", () => {
    const a = { ...fixtureSession("run"), user_id: "alice" };
    storageService.saveSessions([a], "alice");
    enqueue(a);
    expect(storageService.loadSessions("bob")).toEqual([]);
    expect(pendingSessions("bob")).toEqual([]);
    expect(storageService.loadSessions()).toEqual([]);
    expect(pendingSessions("alice")).toEqual([a]);
  });
  it("merges idempotently and preserves pending local activities", () => {
    const a = fixtureSession("bike");
    const b = { ...a, distance: a.distance + 1 };
    expect(mergeSessions([a], [b])).toEqual([b]);
    expect(mergeSessions([a], [a])).toHaveLength(1);
    expect(validSession({ ...a, distance: -1 })).toBe(false);
    expect(
      validSession({
        ...a,
        measurements: [{ ...a.measurements[0], session_id: "other" }],
      }),
    ).toBe(false);
  });
  it("retains outbox entries after a failed upload", async () => {
    const a = { ...fixtureSession("run"), user_id: "alice" };
    enqueue(a);
    mock.rpc.mockResolvedValue({ error: new Error("offline") });
    await expect(synchronize("alice")).rejects.toThrow("offline");
    expect(pendingSessions("alice")).toEqual([a]);
  });
  it("imports idempotently with separate primary keys for every owner", async () => {
    const original = fixtureSession("vehicle");
    const snapshot = structuredClone(original);
    const alice = await importActivity(original, "alice");
    const bob = await importActivity(original, "bob");
    expect(await importActivity(original, "alice")).toEqual(alice);
    expect(alice.id).not.toBe(bob.id);
    expect(alice.id).not.toBe(original.id);
    expect(validSession(alice)).toBe(true);
    expect(validSession(bob)).toBe(true);
    for (const field of ["measurements", "splits", "events"] as const) {
      const ids = new Set(alice[field].map((row) => row.id));
      expect(bob[field].every((row) => !ids.has(row.id))).toBe(true);
    }
    expect(original).toEqual(snapshot);
  });
  it("ignores corrupt rows without losing other cached activities", () => {
    const session = { ...fixtureSession("run"), user_id: "alice" };
    for (const field of ["measurements", "splits", "events"] as const) {
      const invalid = { ...session, [field]: [null] };
      expect(validSession(invalid)).toBe(false);
      localStorage.setItem(
        "speedtrack.sessions.alice",
        JSON.stringify([invalid, session]),
      );
      expect(storageService.loadSessions("alice")).toEqual([session]);
    }
  });
  it("removes only acknowledged entries and reads cloud history", async () => {
    const a = { ...fixtureSession("run"), user_id: "alice" };
    enqueue(a);
    const b = { ...fixtureSession("bike"), user_id: "alice" };
    mock.rpc.mockImplementation(async () => {
      enqueue(b);
      return { error: null };
    });
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [{ payload: a }], error: null }),
    };
    mock.from.mockReturnValue(builder);
    expect(await synchronize("alice")).toEqual([a]);
    expect(pendingSessions("alice")).toEqual([b]);
    expect(builder.eq).toHaveBeenCalledWith("user_id", "alice");
  });
});
