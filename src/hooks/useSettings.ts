import { useCallback, useEffect, useRef, useState } from "react";
import type { Settings } from "../types";
import { storageService } from "../services/storageService";
import { supabase } from "../services/supabase";
export function useSettings(owner: string) {
  const [settings, setSettings] = useState(() =>
    storageService.loadSettings(owner),
  );
  const current = useRef(settings),
    version = useRef(0),
    running = useRef(false);
  const [error, setError] = useState(false),
    [pending, setPending] = useState(false);
  const key = `speedtrack.settingsDirty.${owner}`;
  const sync = useCallback(async () => {
    if (!supabase || owner === "local-user" || running.current) return;
    running.current = true;
    const before = version.current;
    try {
      if (localStorage.getItem(key) === "true") {
        const { error } = await supabase
          .from("user_settings")
          .upsert({ user_id: owner, payload: current.current });
        if (error) throw error;
        if (before === version.current) {
          localStorage.removeItem(key);
          setPending(false);
        }
      } else {
        const { data, error } = await supabase
          .from("user_settings")
          .select("payload")
          .eq("user_id", owner)
          .maybeSingle();
        if (error) throw error;
        if (before === version.current) setPending(false);
        if (data && before === version.current) {
          const saved = storageService.saveSettings(data.payload, owner);
          if (saved) {
            const next = storageService.loadSettings(owner);
            current.current = next;
            setSettings(next);
          } else setError(true);
        }
      }
    } catch {
      setPending(true);
    } finally {
      running.current = false;
    }
  }, [key, owner]);
  useEffect(() => {
    void sync();
    const retry = () => void sync();
    window.addEventListener("online", retry);
    const timer = window.setInterval(retry, 60000);
    return () => {
      window.removeEventListener("online", retry);
      window.clearInterval(timer);
    };
  }, [sync]);
  useEffect(() => {
    // Remote reads must not schedule another remote read through setSettings.
    try {
      if (localStorage.getItem(key) !== 'true') return;
    } catch {return;}
    const timer = window.setTimeout(() => void sync(), 800);
    return () => window.clearTimeout(timer);
  }, [settings, sync, key]);
  const update = (next: Settings) => {
    version.current++;
    current.current = next;
    setSettings(next);
    setError(!storageService.saveSettings(next, owner));
    if (owner !== "local-user") {
      try {
        localStorage.setItem(key, "true");
        setPending(true);
      } catch {
        setError(true);
      }
    }
  };
  return { settings, update, error, pending };
}
