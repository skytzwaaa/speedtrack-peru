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
  const code = url.searchParams.get("code");
  let result;
  if (code) result = await client.auth.exchangeCodeForSession(code);
  else {
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (!access_token || !refresh_token) throw { code: "otp_expired" };
    result = await client.auth.setSession({ access_token, refresh_token });
  }
  if (result.error) throw result.error;
  return {
    recovery: params.get("type") === "recovery",
    userId: result.data.user?.id,
  };
}
