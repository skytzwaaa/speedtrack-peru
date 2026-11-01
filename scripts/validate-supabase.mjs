// Explicit opt-in integration test: creates two temporary users, then deletes
// only those users (their test data cascades). Never prints or stores secrets.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chromium, expect } from "@playwright/test";

assert(
  process.argv.includes("--linked"),
  "Use --linked to opt into real backend tests",
);
const env = parseEnv(readFileSync(".env", "utf8"));
const ref = readFileSync("supabase/.temp/project-ref", "utf8").trim();
assert(/^[a-z]{20}$/.test(ref), "Invalid linked project ref");
const url = env.VITE_SUPABASE_URL;
assert.equal(
  url,
  `https://${ref}.supabase.co`,
  "The .env must match the linked project",
);
const publicKey =
  env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
// CLI credentials are used only for test setup/cleanup; all assertions use
// public-key clients with real user JWTs, or a completely anonymous client.
const command = `npx --yes supabase projects api-keys --project-ref ${ref} -o json`;
const raw =
  process.platform === "win32"
    ? execFileSync("cmd.exe", ["/d", "/s", "/c", command], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      })
    : execFileSync(
        "npx",
        [
          "--yes",
          "supabase",
          "projects",
          "api-keys",
          "--project-ref",
          ref,
          "-o",
          "json",
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
const serviceKey = JSON.parse(raw).find(
  (k) => k.name === "service_role",
)?.api_key;
assert(
  serviceKey,
  "CLI must provide an administrative key for temporary test accounts",
);
const options = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};
const admin = createClient(url, serviceKey, options);
const client = () => createClient(url, publicKey, options);
const users = [];
const clients = [];
const tables = [
  "profiles",
  "sessions",
  "measurements",
  "splits",
  "events",
  "user_settings",
];
function checked(result, label) {
  assert(!result.error, `${label}: ${result.error?.message}`);
  return result.data;
}
function fixture(owner) {
  const id = randomUUID();
  const now = Date.now();
  return {
    id,
    user_id: owner,
    type: "run",
    demo: true,
    start_time: new Date(now - 600000).toISOString(),
    end_time: new Date(now).toISOString(),
    distance: 1,
    duration: 600,
    avg_speed: 6,
    max_speed: 6,
    max_acceleration: 0,
    max_deceleration: 0,
    above_limit: 0,
    limit: 50,
    goal: null,
    measurements: [
      {
        id: randomUUID(),
        session_id: id,
        timestamp: now,
        elapsed: 600,
        latitude: null,
        longitude: null,
        speed: 6,
        acceleration: 0,
        accuracy: null,
        distance: 1,
      },
    ],
    splits: [
      { id: randomUUID(), session_id: id, kilometer: 1, time: 600, pace: 600 },
    ],
    events: [
      {
        id: randomUUID(),
        session_id: id,
        timestamp: now,
        elapsed: 600,
        type: "accelerate",
        value: 0,
      },
    ],
  };
}
let browser;
try {
  const settingsResponse = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: publicKey },
  });
  assert(settingsResponse.ok, "Auth settings must be accessible");
  const settings = await settingsResponse.json();
  assert.equal(
    settings.external.email,
    true,
    "Email/password provider must be enabled",
  );
  console.log(
    `Auth: email enabled; email confirmation ${settings.mailer_autoconfirm ? "disabled" : "required"}`,
  );
  for (const name of ["Validation A", "Validation B"]) {
    const api = client();
    clients.push(api);
    const email = `speedtrack-validation-${randomUUID()}@example.com`;
    const password = `${randomUUID()}Aa9!`;
    const signup = await api.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    let user = signup.data.user;
    if (signup.error) {
      // Hosted default mail may reject recipients or rate-limit signup emails.
      // Do not disable email confirmation globally or claim email delivery passed.
      assert(
        [
          "email_address_invalid",
          "email_address_not_authorized",
          "over_email_send_rate_limit",
          "unexpected_failure",
        ].includes(signup.error.code),
        `Signup failed: ${signup.error.message}`,
      );
      console.log(
        `PUBLIC SIGNUP LIMITATION: ${signup.error.code}: ${signup.error.message}`,
      );
      user = checked(
        await admin.auth.admin.generateLink({
          type: "signup",
          email,
          password,
          options: { data: { name } },
        }),
        "Generate test signup",
      ).user;
    }
    assert(user?.id, "Signup must create a user");
    users.push({ id: user.id, email, password, name, api });
    if (!user.email_confirmed_at) {
      checked(
        await admin.auth.admin.updateUserById(user.id, { email_confirm: true }),
        "Confirm test user",
      );
      console.log(
        "Temporary user's email confirmed through Admin API; mailbox delivery is not tested",
      );
    }
    checked(
      await api.auth.signInWithPassword({ email, password }),
      "Password login",
    );
    assert.equal(
      checked(await api.auth.getUser(), "Validate JWT").user.id,
      user.id,
    );
    const profile = checked(
      await api.from("profiles").select("*").single(),
      "Signup profile trigger",
    );
    assert.equal(profile.name, name);
    checked(
      await api
        .from("profiles")
        .update({ name: `${name} updated` })
        .eq("id", user.id),
      "Update own profile",
    );
    checked(
      await api.from("user_settings").upsert({
        user_id: user.id,
        payload: { language: "es", voice_enabled: false },
      }),
      "Save settings",
    );
    const activity = fixture(user.id);
    users.at(-1).activity = activity;
    for (let attempt = 0; attempt < 2; attempt++)
      checked(
        await api.rpc("save_activity", { activity }),
        "Atomic idempotent save",
      );
  }
  for (const user of users) {
    const other = users.find((u) => u !== user);
    for (const table of tables) {
      const ownerColumn = table === "profiles" ? "id" : "user_id";
      const rows = checked(
        await user.api.from(table).select("*"),
        `Own ${table}`,
      );
      assert.equal(rows.length, 1, `${table}: own row must exist exactly once`);
      assert(
        rows.every((row) => row[ownerColumn] === user.id),
        `${table}: cross-user leak`,
      );
      assert.deepEqual(
        checked(
          await user.api.from(table).select("*").eq(ownerColumn, other.id),
          `Foreign ${table}`,
        ),
        [],
      );
      const changes =
        table === "profiles"
          ? { name: "unauthorized" }
          : { payload: { unauthorized: true } };
      assert.deepEqual(
        checked(
          await user.api
            .from(table)
            .update(changes)
            .eq(ownerColumn, other.id)
            .select(),
          `Foreign update ${table}`,
        ),
        [],
      );
      assert.deepEqual(
        checked(
          await user.api
            .from(table)
            .delete()
            .eq(ownerColumn, other.id)
            .select(),
          `Foreign delete ${table}`,
        ),
        [],
      );
      const forged = { ...rows[0], [ownerColumn]: other.id };
      if (table !== "profiles" && table !== "user_settings")
        forged.id = randomUUID();
      assert(
        (await user.api.from(table).insert(forged)).error,
        `Foreign insert ${table} must fail`,
      );
    }
    assert(
      (await user.api.rpc("save_activity", { activity: other.activity })).error,
      "Forged owner must fail",
    );
    assert(
      (
        await user.api.rpc("save_activity", {
          activity: { ...other.activity, user_id: user.id },
        })
      ).error,
      "Foreign session ID must fail",
    );
    for (const table of ["measurements", "splits", "events"]) {
      assert(
        (
          await user.api.from(table).insert({
            id: randomUUID(),
            session_id: other.activity.id,
            user_id: user.id,
            payload: {},
          })
        ).error,
        "Composite FK must reject foreign session",
      );
    }
    const invalid = {
      ...fixture(user.id),
      measurements: [{ id: randomUUID(), session_id: randomUUID() }],
    };
    assert(
      (await user.api.rpc("save_activity", { activity: invalid })).error,
      "Invalid child must roll back",
    );
    assert.deepEqual(
      checked(
        await user.api.from("sessions").select("id").eq("id", invalid.id),
        "Atomic rollback",
      ),
      [],
    );
    checked(await user.api.auth.refreshSession(), "Refresh session");
    const oldRefresh = (await user.api.auth.getSession()).data.session
      .refresh_token;
    checked(await user.api.auth.signOut({ scope: "local" }), "Logout");
    assert.equal((await user.api.auth.getSession()).data.session, null);
    const probe = client();
    assert(
      (await probe.auth.refreshSession({ refresh_token: oldRefresh })).error,
      "Logout must invalidate refresh token",
    );
    checked(
      await user.api.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      }),
      "Login again",
    );
    assert.deepEqual(
      checked(
        await user.api
          .from("sessions")
          .select("payload")
          .eq("id", user.activity.id)
          .single(),
        "Recover activity",
      ).payload,
      user.activity,
    );
  }
  const anon = client();
  for (const table of tables) {
    const read = await anon.from(table).select("*");
    assert(
      read.error?.code === "42501" || (read.data && read.data.length === 0),
      `anon read ${table}`,
    );
    const source = checked(
      await users[0].api.from(table).select("*").single(),
      `Fixture ${table}`,
    );
    assert(
      (await anon.from(table).insert(source)).error,
      `anon write ${table}`,
    );
  }
  assert(
    (await anon.rpc("save_activity", { activity: users[0].activity })).error,
    "anon RPC must fail",
  );
  console.log(
    "PASS: all six tables, A/B isolation in both directions, anon, foreign writes, composite FK, atomic rollback, idempotency, refresh, logout/login and recovery",
  );

  if (process.env.SPEEDTRACK_TEST_URL) {
    // Run against a production preview built with the actual public config.
    browser = await chromium.launch();
    const page = await browser.newPage();
    page.setDefaultTimeout(20000);
    const tab = (name) =>
      page
        .locator(".bottom-nav")
        .getByRole("button", { name, exact: true })
        .click();
    async function login(user) {
      await tab("Perfil");
      await page.getByLabel("Correo electrónico").fill(user.email);
      await page
        .getByLabel("Contraseña (mínimo 8 caracteres)")
        .fill(user.password);
      await page
        .getByRole("button", { name: "Iniciar sesión", exact: true })
        .click();
      await expect(
        page.getByText(`Hola, ${user.name}`, { exact: true }),
      ).toBeVisible();
      await tab("Perfil");
      await expect(
        page.getByRole("button", { name: "Cerrar sesión", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: "Historial sincronizado",
          exact: true,
        }),
      ).toBeVisible();
    }
    await page.goto(process.env.SPEEDTRACK_TEST_URL);
    await login(users[0]);
    await tab("Actividad");
    await page.getByRole("checkbox", { name: /demostración/ }).check();
    await page
      .getByRole("button", { name: "Iniciar actividad", exact: true })
      .click();
    await page.getByRole("button", { name: "Finalizar", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Historial sincronizado", exact: true }),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          checked(await users[0].api.from("sessions").select("id"), "UI upload")
            .length,
      )
      .toBe(2);
    await tab("Perfil");
    await page
      .getByRole("button", { name: "Cerrar sesión", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Cada recorrido cuenta." }),
    ).toBeVisible();
    await tab("Perfil");
    await expect(
      page.getByRole("button", { name: "Iniciar sesión", exact: true }),
    ).toBeVisible();
    // Clear all local state so recovery can only come from the real database.
    await page.evaluate(() => globalThis.localStorage.clear());
    await page.reload();
    await login(users[0]);
    await tab("Historial");
    await expect(page.locator(".session-card")).toHaveCount(2);
    await tab("Perfil");
    await page
      .getByRole("button", { name: "Cerrar sesión", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Cada recorrido cuenta." }),
    ).toBeVisible();
    await login(users[1]);
    await tab("Historial");
    await expect(page.locator(".session-card")).toHaveCount(1);
    console.log(
      "PASS: real Chromium login -> save -> logout -> clear cache -> login -> cloud recovery -> account B isolation",
    );
  }
} finally {
  if (browser) await browser.close();
  for (const api of clients) await api.auth.signOut({ scope: "local" });
  const errors = [];
  for (const user of users) {
    const result = await admin.auth.admin.deleteUser(user.id);
    if (result.error) errors.push(`${user.id}: ${result.error.message}`);
  }
  assert.equal(
    errors.length,
    0,
    `Temporary user cleanup failed: ${errors.join(", ")}`,
  );
  console.log(`Cleaned up ${users.length} temporary users and their test data`);
}
