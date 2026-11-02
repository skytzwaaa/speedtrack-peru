import type { SupabaseClient } from "@supabase/supabase-js";

export const nativeAuthRedirect = "pe.speedtrack.app://auth/callback";

// Only our exact callback is accepted. Never navigate a WebView to an input URL.
export async function acceptAuthCallback(raw: string, client: SupabaseClient) {
  const url = new URL(raw);
  if (
    url.protocol !== "pe.speedtrack.app:" ||
    url.host !== "auth" ||
    url.pathname !== "/callback"
  )
    return null;
  const params = new URLSearchParams(url.hash.slice(1));
  const error = params.get("error_code") || url.searchParams.get("error_code");
  if (error || params.has("error") || url.searchParams.has("error"))
    throw { code: error || "otp_expired" };
  // Solo PKCE: cualquier app puede lanzar este enlace, así que nunca se
  // aceptan tokens directos (access_token/refresh_token) desde la URL.
  const code = url.searchParams.get("code");
  if (!code) throw { code: "otp_expired" };
  const result = await client.auth.exchangeCodeForSession(code);
  if (result.error) throw result.error;
  return {
    recovery:
      (result.data as { redirectType?: string | null }).redirectType ===
      "recovery",
    userId: result.data.user?.id,
  };
}
