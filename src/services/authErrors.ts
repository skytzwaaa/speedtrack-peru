import type { TranslationKey } from "../i18n/es";

const errors: Record<string, TranslationKey> = {
  user_already_exists: "authEmailExists",
  email_exists: "authEmailExists",
  weak_password: "authPasswordInvalid",
  same_password: "authPasswordSame",
  email_not_confirmed: "authConfirmationPending",
  invalid_credentials: "authCredentialsInvalid",
  email_address_invalid: "authEmailInvalid",
  over_email_send_rate_limit: "authRateLimit",
  over_request_rate_limit: "authRateLimit",
  email_address_not_authorized: "authMailConfiguration",
  signup_disabled: "authConfiguration",
  email_provider_disabled: "authConfiguration",
  provider_disabled: "authConfiguration",
  otp_expired: "authLinkExpired",
  flow_state_expired: "authLinkExpired",
  flow_state_not_found: "authLinkExpired",
  bad_code_verifier: "authLinkExpired",
  request_timeout: "authNetwork",
};

export function authError(error: unknown): {
  key: TranslationKey;
  code: string;
  status?: number;
} {
  const value =
    error && typeof error === "object"
      ? (error as {
          code?: string;
          status?: number;
          name?: string;
          message?: string;
        })
      : {};
  // Never log messages, URLs, emails, passwords or tokens from provider errors.
  const code =
    typeof value.code === "string" && /^[a-z_]{1,64}$/.test(value.code)
      ? value.code
      : "unknown";
  const status = typeof value.status === "number" ? value.status : undefined;
  let key = errors[code];
  if (!key && status === 429) key = "authRateLimit";
  if (
    !key &&
    (value.name === "AuthRetryableFetchError" ||
      value.name === "TypeError" ||
      value.name === "AbortError" ||
      (typeof navigator !== "undefined" && navigator.onLine === false))
  )
    key = "authNetwork";
  if (
    !key &&
    /invalid api key|no api key|invalid jwt/i.test(value.message ?? "")
  )
    key = "authConfiguration";
  if (!key && /sending.*email|smtp/i.test(value.message ?? ""))
    key = "authMailConfiguration";
  return { key: key || "authUnknown", code, status };
}
