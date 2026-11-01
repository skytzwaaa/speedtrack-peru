import { describe, expect, it } from "vitest";
import { supabaseConfig } from "./supabaseConfig";

describe("Supabase frontend configuration", () => {
  const url = "https://example.supabase.co";
  const jwt = (role: string) =>
    `header.${btoa(JSON.stringify({ role }))}.signature`;
  it("uses the configured publishable key and supports legacy anon keys", () => {
    expect(
      supabaseConfig({
        VITE_SUPABASE_URL: url,
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      }),
    ).toEqual({ url, key: "sb_publishable_test" });
    expect(
      supabaseConfig({
        VITE_SUPABASE_URL: url,
        VITE_SUPABASE_ANON_KEY: jwt("anon"),
      })?.key,
    ).toBe(jwt("anon"));
    expect(
      supabaseConfig({
        VITE_SUPABASE_URL: url,
        VITE_SUPABASE_PUBLISHABLE_KEY: "new",
        VITE_SUPABASE_ANON_KEY: "old",
      })?.key,
    ).toBe("new");
  });
  it("allows guest mode only when both values are absent", () => {
    expect(supabaseConfig({})).toBeNull();
    expect(() => supabaseConfig({ VITE_SUPABASE_URL: url })).toThrow(
      "Configure both",
    );
  });
  it("blocks privileged keys, including an unused legacy fallback", () => {
    for (const key of ["sb_secret_private", jwt("service_role")]) {
      expect(() =>
        supabaseConfig({
          VITE_SUPABASE_URL: url,
          VITE_SUPABASE_PUBLISHABLE_KEY: key,
        }),
      ).toThrow("publishable/anon");
      expect(() =>
        supabaseConfig({
          VITE_SUPABASE_URL: url,
          VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
          VITE_SUPABASE_ANON_KEY: key,
        }),
      ).toThrow("publishable/anon");
    }
  });
});
