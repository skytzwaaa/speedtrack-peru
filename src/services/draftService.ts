import type { Session } from "../types";
import { validSession } from "./activityRepository";
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
      localStorage.setItem(key(s.user_id), JSON.stringify(s));
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
