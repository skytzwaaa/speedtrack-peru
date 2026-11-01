import { describe, expect, it } from "vitest";
import { authError } from "./authErrors";

describe("safe Auth diagnostics", () => {
  it.each([
    ["user_already_exists", "authEmailExists"],
    ["weak_password", "authPasswordInvalid"],
    ["email_not_confirmed", "authConfirmationPending"],
    ["over_email_send_rate_limit", "authRateLimit"],
    ["email_address_not_authorized", "authMailConfiguration"],
    ["invalid_credentials", "authCredentialsInvalid"],
    ["otp_expired", "authLinkExpired"],
  ])("maps %s without exposing the provider message", (code, key) => {
    const result = authError({
      code,
      status: 400,
      message: "private@example.com secret-token",
    });
    expect(result).toEqual({ key, code, status: 400 });
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("distinguishes network, gateway configuration and unknown errors", () => {
    expect(authError(new TypeError("Failed to fetch")).key).toBe("authNetwork");
    expect(authError({ message: "Invalid API key" }).key).toBe(
      "authConfiguration",
    );
    expect(authError({ status: 429 }).key).toBe("authRateLimit");
    expect(authError({ code: "https://private?token=secret" }).code).toBe(
      "unknown",
    );
    expect(authError(null).key).toBe("authUnknown");
  });
});
