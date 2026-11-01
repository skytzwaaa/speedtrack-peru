import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { acceptAuthCallback, nativeAuthRedirect } from "./authCallback";
const setup = () => {
  const auth = {
    setSession: vi
      .fn()
      .mockResolvedValue({ data: { user: { id: "owner" } }, error: null }),
    exchangeCodeForSession: vi
      .fn()
      .mockResolvedValue({ data: { user: { id: "owner" } }, error: null }),
  };
  return { auth, client: { auth } as unknown as SupabaseClient };
};
it("accepts recovery tokens only on the exact native callback", async () => {
  const { auth, client } = setup();
  expect(
    await acceptAuthCallback(
      `${nativeAuthRedirect}#access_token=a&refresh_token=r&type=recovery`,
      client,
    ),
  ).toEqual({ recovery: true, userId: "owner" });
  expect(auth.setSession).toHaveBeenCalledWith({
    access_token: "a",
    refresh_token: "r",
  });
  for (const url of [
    "https://evil.test/auth/callback",
    "pe.speedtrack.app://evil/callback",
    "pe.speedtrack.app://auth/other",
  ]) {
    expect(
      await acceptAuthCallback(`${url}#access_token=a&refresh_token=r`, client),
    ).toBeNull();
  }
  expect(auth.setSession).toHaveBeenCalledTimes(1);
});
it("rejects expired or incomplete callbacks without creating a session", async () => {
  const { auth, client } = setup();
  await expect(
    acceptAuthCallback(
      `${nativeAuthRedirect}#error=access_denied&error_code=otp_expired`,
      client,
    ),
  ).rejects.toEqual({ code: "otp_expired" });
  await expect(acceptAuthCallback(nativeAuthRedirect, client)).rejects.toEqual({
    code: "otp_expired",
  });
  expect(auth.setSession).not.toHaveBeenCalled();
});
