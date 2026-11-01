import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { translate } from "../i18n";
import { storageService } from "../services/storageService";
import { supabase } from "../services/supabase";
import { Capacitor } from "@capacitor/core";
import { App as NativeApp } from "@capacitor/app";
import { acceptAuthCallback } from "../services/authCallback";
import { authError } from "../services/authErrors";
import type { TranslationKey } from "../i18n/es";
const AuthContext = createContext<{
  user: User | null;
  recovery: boolean;
  recovered: () => void;
  notice: TranslationKey | null;
  setNotice: (notice: TranslationKey | null) => void;
}>({
  user: null,
  recovery: false,
  recovered: () => {},
  notice: null,
  setNotice: () => {},
});
export const useAuth = () => useContext(AuthContext);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [recovery, setRecovery] = useState(false);
  const [notice, setNotice] = useState<TranslationKey | null>(null);
  useEffect(() => {
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") {
        setRecovery(true);
        try {
          sessionStorage.setItem("speedtrack.recovery", session!.user.id);
        } catch {
          /* storage may be unavailable */
        }
      }
      if (event === "INITIAL_SESSION" && session) {
        try {
          setRecovery(
            sessionStorage.getItem("speedtrack.recovery") === session.user.id,
          );
        } catch {
          /* keep in-memory state */
        }
      }
      if (event === "SIGNED_OUT") {
        setRecovery(false);
        try {
          sessionStorage.removeItem("speedtrack.recovery");
        } catch {
          /* keep in-memory state */
        }
      }
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!supabase) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    if (params.has("error") || query.has("error")) {
      setNotice(
        authError({
          code:
            params.get("error_code") ||
            query.get("error_code") ||
            "otp_expired",
        }).key,
      );
      window.history.replaceState(null, "", window.location.pathname);
    }
    if (!Capacitor.isNativePlatform()) return;
    let live = true;
    let lastUrl = "";
    const handle = async (url: string) => {
      if (!live || url === lastUrl) return;
      lastUrl = url;
      try {
        const result = await acceptAuthCallback(url, supabase!);
        if (!live || !result) return;
        setRecovery(result.recovery);
        if (result.recovery && result.userId) {
          try {
            sessionStorage.setItem("speedtrack.recovery", result.userId);
          } catch {
            /* optional persistence */
          }
        } else setNotice("authConfirmed");
      } catch (error) {
        if (live) setNotice(authError(error).key);
      }
    };
    const listener = NativeApp.addListener("appUrlOpen", ({ url }) => {
      void handle(url);
    });
    void NativeApp.getLaunchUrl()
      .then((value) => {
        if (value) void handle(value.url);
      })
      .catch(() => {
        if (live) setNotice("authConfiguration");
      });
    return () => {
      live = false;
      void listener.then((handle) => handle.remove());
    };
  }, []);
  if (!ready)
    return (
      <div className="notice" role="status">
        {translate(storageService.loadSettings().language, "loading")}
      </div>
    );
  return (
    <AuthContext.Provider
      value={{
        user,
        recovery,
        notice,
        setNotice,
        recovered: () => {
          setRecovery(false);
          try {
            sessionStorage.removeItem("speedtrack.recovery");
          } catch {
            /* optional persistence */
          }
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
