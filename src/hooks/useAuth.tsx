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
const AuthContext = createContext<{
  user: User | null;
  recovery: boolean;
  recovered: () => void;
}>({ user: null, recovery: false, recovered: () => {} });
export const useAuth = () => useContext(AuthContext);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") setRecovery(false);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);
  if (!ready)
    return (
      <div className="notice" role="status">
        {translate(storageService.loadSettings().language, "loading")}
      </div>
    );
  return (
    <AuthContext.Provider
      value={{ user, recovery, recovered: () => setRecovery(false) }}
    >
      {children}
    </AuthContext.Provider>
  );
}
