export function supabaseConfig(env: Record<string, string | undefined>) {
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = (
    env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY
  )?.trim();
  for (const candidate of [
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
    env.VITE_SUPABASE_ANON_KEY,
  ]) {
    if (candidate?.trim().startsWith("sb_secret_"))
      throw new Error(
        "Supabase requires a publishable/anon key in the frontend.",
      );
    if (candidate?.split(".").length === 3) {
      let role: unknown;
      try {
        role = JSON.parse(
          atob(candidate.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
        ).role;
      } catch {
        throw new Error("Invalid Supabase anon key.");
      }
      if (role !== "anon")
        throw new Error(
          "Supabase requires a publishable/anon key in the frontend.",
        );
    }
  }
  if (Boolean(url) !== Boolean(key))
    throw new Error(
      "Configure both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
    );
  return url && key ? { url, key } : null;
}
