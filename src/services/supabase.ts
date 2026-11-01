import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./supabaseConfig";
import { Capacitor } from "@capacitor/core";
import { nativeAuthRedirect } from "./authCallback";
const config = supabaseConfig({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
});
// Only a publishable/anon key belongs in this bundle. RLS is the security boundary.
export const supabase = config
  ? createClient(config.url, config.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
export const authRedirect = Capacitor.isNativePlatform()
  ? nativeAuthRedirect
  : import.meta.env.VITE_AUTH_REDIRECT_URL ||
    (typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:5173");
