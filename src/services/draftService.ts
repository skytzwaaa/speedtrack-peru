import type { Session } from "../types";
import { validSession } from "./activityRepository";
const MAX_POINTS = 2000;
// El borrador se reescribe completo cada pocos segundos y localStorage tiene
// ~5 MB: en actividades largas se conservan ≤2000 muestras (siempre la primera,
// la última y las que marcan un corte). Los totales ya están en la sesión.
export const thin = (s: Session): Session => {
  const m = s.measurements;
  if (m.length <= MAX_POINTS) return s;
  const step = Math.ceil(m.length / MAX_POINTS);
  return {
    ...s,
    measurements: m.filter(
      (p, i) => i % step === 0 || i === m.length - 1 || p.break_before,
    ),
  };
};
const key = (owner: string) => `speedtrack.draft.${owner}`;
export const draftService = {
  read(owner: string): Session | null {
    try {
      const s: unknown = JSON.parse(localStorage.getItem(key(owner)) || "null");
      return validSession(s) && s.user_id === owner ? s : null;
    } catch {
      return null;
    }
  },
  write(s: Session) {
    try {
      localStorage.setItem(key(s.user_id), JSON.stringify(thin(s)));
      return true;
    } catch {
      return false;
    }
  },
  clear(owner: string) {
    try {
      localStorage.removeItem(key(owner));
    } catch {
      /* A retained draft remains recoverable. */
    }
  },
};
