import type { Session } from "../types";
import { supabase } from "./supabase";

export function validSession(value: unknown): value is Session {
  if (!value || typeof value !== "object") return false;
  const s = value as Session;
  return (
    typeof s.id === "string" &&
    typeof s.user_id === "string" &&
    ["walk", "run", "bike", "vehicle"].includes(s.type) &&
    typeof s.demo === "boolean" &&
    (s.steps === undefined || (Number.isFinite(s.steps) && s.steps >= 0)) &&
    Number.isFinite(Date.parse(s.start_time)) &&
    [
      s.distance,
      s.duration,
      s.avg_speed,
      s.max_speed,
      s.max_acceleration,
      s.max_deceleration,
      s.above_limit,
    ].every((n) => Number.isFinite(n) && n >= 0) &&
    Array.isArray(s.measurements) &&
    s.measurements.every(
      (m) =>
        !!m &&
        m.session_id === s.id &&
        [m.timestamp, m.elapsed, m.distance, m.speed, m.acceleration].every(
          Number.isFinite,
        ) &&
        m.speed >= 0 &&
        m.distance >= 0 &&
        (m.latitude === null ||
          (Number.isFinite(m.latitude) && Math.abs(m.latitude) <= 90)) &&
        (m.longitude === null ||
          (Number.isFinite(m.longitude) && Math.abs(m.longitude) <= 180)),
    ) &&
    Array.isArray(s.splits) &&
    s.splits.every(
      (x) =>
        !!x &&
        x.session_id === s.id &&
        x.kilometer > 0 &&
        Number.isFinite(x.time) &&
        x.time >= 0 &&
        Number.isFinite(x.pace),
    ) &&
    Array.isArray(s.events) &&
    s.events.every(
      (x) =>
        !!x &&
        x.session_id === s.id &&
        ["brake", "accelerate", "over"].includes(x.type) &&
        Number.isFinite(x.value),
    )
  );
}
export function mergeSessions(remote: Session[], local: Session[]) {
  // Completed sessions are immutable. Local outbox entries win until acknowledged.
  // Las actividades de demostración de versiones anteriores se ignoran.
  return [
    ...new Map(
      [...remote, ...local].filter((s) => !s.demo).map((s) => [s.id, s]),
    ).values(),
  ].sort((a, b) => Date.parse(b.start_time) - Date.parse(a.start_time));
}
const key = (owner: string) => `speedtrack.outbox.${owner}`;
export function pendingSessions(owner: string): Session[] {
  try {
    const rows: unknown = JSON.parse(localStorage.getItem(key(owner)) || "[]");
    return Array.isArray(rows)
      ? rows.filter(validSession).filter((s) => !s.demo && s.user_id === owner)
      : [];
  } catch {
    return [];
  }
}
export function enqueue(session: Session) {
  localStorage.setItem(
    key(session.user_id),
    JSON.stringify(mergeSessions(pendingSessions(session.user_id), [session])),
  );
}
// Stable per-account IDs allow explicit imports on shared devices without
// colliding with another account's primary keys or duplicating retries.
export async function importActivity(
  session: Session,
  owner: string,
): Promise<Session> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify([owner, session.id])),
    ),
  ).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return {
    ...session,
    id,
    user_id: owner,
    measurements: session.measurements.map((m, i) => ({
      ...m,
      id: `${id}:m:${i}`,
      session_id: id,
    })),
    splits: session.splits.map((s, i) => ({
      ...s,
      id: `${id}:s:${i}`,
      session_id: id,
    })),
    events: session.events.map((e, i) => ({
      ...e,
      id: `${id}:e:${i}`,
      session_id: id,
    })),
  };
}
export async function synchronize(owner: string) {
  if (!supabase) return [];
  for (const s of pendingSessions(owner)) {
    const { error } = await supabase.rpc("save_activity", { activity: s });
    if (error) throw error;
    // Read again: a new activity may have been queued while this request ran.
    localStorage.setItem(
      key(owner),
      JSON.stringify(pendingSessions(owner).filter((x) => x.id !== s.id)),
    );
  }
  const result: Session[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase
      .from("sessions")
      .select("payload")
      .eq("user_id", owner)
      .order("id")
      .range(offset, offset + 99);
    if (error) throw error;
    result.push(
      ...(data ?? [])
        .map((x) => x.payload)
        .filter(validSession)
        .filter((s) => s.user_id === owner),
    );
    if (!data || data.length < 100) break;
  }
  return result;
}
