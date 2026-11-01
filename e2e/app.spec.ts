import { test, expect, type Page } from "@playwright/test";
async function mocks(page: Page) {
  await page.route("https://tiles.openfreemap.org/**", (r) =>
    r.fulfill({
      json: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "bg",
            type: "background",
            paint: { "background-color": "#203020" },
          },
        ],
      },
    }),
  );
  await page.route("https://fonts.googleapis.com/**", (r) =>
    r.fulfill({ body: "" }),
  );
  await page.route("https://speedtrack-test.supabase.co/**", async (r) => {
    const url = r.request().url();
    if (url.includes("/token")) {
      const email = r.request().postDataJSON().email;
      const id =
        email === "alice@example.com"
          ? "11111111-1111-4111-8111-111111111111"
          : "22222222-2222-4222-8222-222222222222";
      const access_token = [
        btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })),
        btoa(
          JSON.stringify({
            sub: id,
            exp: Math.floor(Date.now() / 1000) + 3600,
            role: "authenticated",
            aud: "authenticated",
          }),
        ),
        "test-signature",
      ].join(".");
      return r.fulfill({
        json: {
          access_token,
          refresh_token: "test-refresh",
          token_type: "bearer",
          expires_in: 3600,
          user: {
            id,
            email,
            aud: "authenticated",
            role: "authenticated",
            user_metadata: { name: email.split("@")[0] },
            created_at: new Date().toISOString(),
          },
        },
      });
    }
    if (url.includes("/logout")) return r.fulfill({ status: 204 });
    if (url.includes("/profiles") || url.includes("/user_settings"))
      return r.fulfill({ json: null });
    return r.fulfill({ json: [] });
  });
}
async function tab(page: Page, name: string) {
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name, exact: true })
    .click();
}

test("an outbox quota failure preserves the draft until recovery can queue it", async ({
  page,
}) => {
  await mocks(page);
  await page.goto("/");
  await tab(page, "Perfil");
  await page.getByLabel("Correo electrónico").fill("alice@example.com");
  await page
    .getByLabel("Contraseña (mínimo 8 caracteres)")
    .fill("test-password");
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(page.getByText("Hola, alice")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Historial sincronizado" }),
  ).toBeVisible();
  await page.evaluate(() => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("speedtrack.outbox."))
        throw new DOMException("Full", "QuotaExceededError");
      return write.call(this, key, value);
    };
  });
  await tab(page, "Actividad");
  await page.getByRole("checkbox", { name: /demostración/ }).check();
  await page
    .getByRole("button", { name: "Iniciar actividad", exact: true })
    .click();
  await page.getByRole("button", { name: "Finalizar", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Recuperar actividad interrumpida en el historial",
    }),
  ).toBeVisible();
  const draftKey = "speedtrack.draft.11111111-1111-4111-8111-111111111111";
  expect(
    await page.evaluate((key) => localStorage.getItem(key), draftKey),
  ).not.toBeNull();
  await page.reload();
  await page
    .getByRole("button", {
      name: "Recuperar actividad interrumpida en el historial",
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Historial sincronizado" }),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), draftKey),
  ).toBeNull();
  await tab(page, "Historial");
  await expect(page.locator(".session-card")).toHaveCount(1);
});
test("registration and password recovery forms use Supabase Auth contracts", async ({
  page,
}) => {
  await mocks(page);
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "alice@example.com",
    aud: "authenticated",
    role: "authenticated",
    user_metadata: { name: "Alice" },
    created_at: new Date().toISOString(),
  };
  let registered = false,
    recoveryRequested = false,
    updated = false;
  await page.route(
    "https://speedtrack-test.supabase.co/auth/v1/signup**",
    (r) => {
      registered = !!r.request().postDataJSON().email;
      return r.fulfill({ json: { user, session: null } });
    },
  );
  await page.route(
    "https://speedtrack-test.supabase.co/auth/v1/recover**",
    (r) => {
      recoveryRequested = true;
      return r.fulfill({ json: {} });
    },
  );
  await page.route("https://speedtrack-test.supabase.co/auth/v1/user", (r) => {
    if (r.request().method() === "PUT") updated = true;
    return r.fulfill({ json: user });
  });
  await page.goto("/");
  await tab(page, "Perfil");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Alice");
  await page.getByLabel("Correo electrónico").fill(user.email);
  await page
    .getByLabel("Contraseña (mínimo 8 caracteres)")
    .fill("test-password");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page.getByText(/Solicitud completada/)).toBeVisible();
  expect(registered).toBe(true);
  await page
    .getByRole("button", { name: "Recuperar contraseña", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Recuperar contraseña", exact: true })
    .click();
  await expect(page.getByText(/Solicitud completada/)).toBeVisible();
  expect(recoveryRequested).toBe(true);
  const token = [
    btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })),
    btoa(
      JSON.stringify({
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) + 3600,
        role: "authenticated",
        aud: "authenticated",
      }),
    ),
    "test-signature",
  ].join(".");
  // Opening the email link creates a document navigation; changing only the
  // fragment of the running app would not initialize Supabase again.
  await page.goto("about:blank");
  await page.goto(
    `/#access_token=${token}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=recovery`,
  );
  await page
    .getByLabel("Contraseña (mínimo 8 caracteres)")
    .fill("new-test-password");
  await page
    .getByRole("button", { name: "Guardar nueva contraseña", exact: true })
    .click();
  await expect.poll(() => updated).toBe(true);
});
test("preserves demo, pause, summary, language and local history", async ({
  page,
}) => {
  await mocks(page);
  await page.clock.install();
  await page.goto("/");
  await tab(page, "Actividad");
  await page.getByRole("checkbox", { name: /demostración/ }).check();
  await page
    .getByRole("button", { name: "Iniciar actividad", exact: true })
    .click();
  await page.clock.runFor(5000);
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "En pausa" })).toBeVisible();
  await page.getByRole("button", { name: "Reanudar", exact: true }).click();
  await page.clock.runFor(45000);
  await expect(
    page.getByRole("heading", { name: "Resumen del entrenamiento" }),
  ).toBeVisible();
  await expect(page.getByText("Guardado en tu historial")).toBeVisible();
  await page.reload();
  await tab(page, "Historial");
  await expect(page.locator(".session-card")).toHaveCount(4);
  await tab(page, "Perfil");
  await page.locator("#language").selectOption("en");
  await expect(
    page.locator(".bottom-nav").getByRole("button", { name: "History" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator(".bottom-nav").getByRole("button", { name: "History" }),
  ).toBeVisible();
});
test("GPS captures real samples and recovers an interrupted draft", async ({
  page,
  context,
}) => {
  await mocks(page);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({
    latitude: -12.12,
    longitude: -77.03,
    accuracy: 5,
  });
  await page.goto("/");
  await tab(page, "Actividad");
  await page
    .getByRole("button", { name: "Iniciar actividad", exact: true })
    .click();
  await expect(
    page.locator("p").filter({ hasText: /Precisión GPS estimada: ± 5/ }),
  ).toBeVisible();
  await page.waitForTimeout(5500);
  await context.setGeolocation({
    latitude: -12.11995,
    longitude: -77.03,
    accuracy: 5,
  });
  await page.waitForTimeout(1200);
  await page.reload();
  await page
    .getByRole("button", {
      name: "Recuperar actividad interrumpida en el historial",
    })
    .click();
  await tab(page, "Historial");
  await expect(page.locator(".session-card")).toHaveCount(4);
  await page.locator(".session-card").first().click();
  await expect(
    page.getByText("GPS real", { exact: false }).first(),
  ).toBeVisible();
});
test("account switch never displays another account history and import is explicit", async ({
  page,
}) => {
  await mocks(page);
  await page.goto("/");
  await tab(page, "Perfil");
  await page.getByLabel("Correo electrónico").fill("alice@example.com");
  await page
    .getByLabel("Contraseña (mínimo 8 caracteres)")
    .fill("test-password");
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await tab(page, "Historial");
  await expect(page.locator(".session-card")).toHaveCount(0);
  await tab(page, "Perfil");
  await expect(
    page.getByText("alice@example.com", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await tab(page, "Historial");
  await expect(page.locator(".session-card")).toHaveCount(3);
  await tab(page, "Perfil");
  await page.getByLabel("Correo electrónico").fill("bob@example.com");
  await page
    .getByLabel("Contraseña (mínimo 8 caracteres)")
    .fill("test-password");
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await tab(page, "Historial");
  await expect(page.locator(".session-card")).toHaveCount(0);
});
test("destination uses the cycling profile and handles unavailable routing", async ({
  page,
  context,
}) => {
  await mocks(page);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({
    latitude: -12.12,
    longitude: -77.03,
    accuracy: 5,
  });
  let profile = "";
  await page.route("https://api.openrouteservice.org/v2/directions/**", (r) => {
    profile = r.request().url();
    return r.fulfill({
      json: {
        features: [
          {
            geometry: {
              coordinates: [
                [-77.03, -12.12],
                [-77.02, -12.12],
              ],
            },
            properties: { summary: { distance: 1100, duration: 300 } },
          },
        ],
      },
    });
  });
  await page.goto("/");
  await tab(page, "Actividad");
  await page.getByRole("button", { name: "Ciclismo", exact: true }).click();
  await page.getByRole("button", { name: "Centrar en mi ubicación" }).click();
  await page.locator(".map-canvas").click({ position: { x: 230, y: 150 } });
  await page.getByRole("button", { name: "Calcular ruta" }).click();
  await expect(page.getByText("Distancia de la ruta")).toBeVisible();
  expect(profile).toContain("cycling-regular");
  await page.getByRole("button", { name: "Caminar", exact: true }).click();
  await expect(page.getByText("Distancia de la ruta")).toHaveCount(0);
  await page.route("https://api.openrouteservice.org/v2/directions/**", (r) =>
    r.fulfill({ status: 503 }),
  );
  await page.getByRole("button", { name: "Calcular ruta" }).click();
  await expect(page.getByText(/Ruta no disponible/)).toBeVisible();
});

test("an authenticated activity survives failed upload and retries without duplication", async ({
  page,
}) => {
  await mocks(page);
  let online = false;
  const saved: unknown[] = [];
  await page.route(
    "https://speedtrack-test.supabase.co/rest/v1/rpc/save_activity",
    async (r) => {
      if (!online)
        return r.fulfill({ status: 503, json: { message: "offline" } });
      saved.push(r.request().postDataJSON().activity);
      return r.fulfill({ json: null });
    },
  );
  await page.goto("/");
  await tab(page, "Perfil");
  await page.getByLabel("Correo electrónico").fill("alice@example.com");
  await page
    .getByLabel("Contraseña (mínimo 8 caracteres)")
    .fill("test-password");
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(page.getByText("Hola, alice")).toBeVisible();
  await tab(page, "Actividad");
  await page.getByRole("checkbox", { name: /demostración/ }).check();
  await page
    .getByRole("button", { name: "Iniciar actividad", exact: true })
    .click();
  await page.getByRole("button", { name: "Finalizar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pendiente de sincronizar · reintentar" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem(
              "speedtrack.outbox.11111111-1111-4111-8111-111111111111",
            ) || "[]",
          ).length,
      ),
    )
    .toBe(1);
  online = true;
  await page
    .getByRole("button", { name: "Pendiente de sincronizar · reintentar" })
    .click();
  await expect(
    page.getByRole("button", { name: "Historial sincronizado" }),
  ).toBeVisible();
  expect(saved).toHaveLength(1);
  await tab(page, "Historial");
  await expect(page.locator(".session-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Historial sincronizado" }).click();
  await expect(
    page.getByRole("button", { name: "Historial sincronizado" }),
  ).toBeVisible();
  expect(saved).toHaveLength(1);
});

test("live GPS rejects noise and gaps, preserves destination and track through pause and map gestures", async ({
  page,
}) => {
  await mocks(page);
  await page.route("https://api.openrouteservice.org/v2/directions/**", (r) =>
    r.fulfill({
      json: {
        features: [
          {
            geometry: { coordinates: r.request().postDataJSON().coordinates },
            properties: { summary: { distance: 500, duration: 300 } },
          },
        ],
      },
    }),
  );
  await page.addInitScript(() => {
    let callback: PositionCallback;
    Object.defineProperty(navigator, "geolocation", {
      value: {
        watchPosition: (cb: PositionCallback) => {
          callback = cb;
          return 1;
        },
        clearWatch: () => {},
      },
    });
    Object.assign(window, {
      emitGps: (longitude: number, accuracy = 5) =>
        callback({
          timestamp: Date.now(),
          coords: {
            latitude: -12.12,
            longitude,
            accuracy,
            speed: null,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
          },
        } as GeolocationPosition),
    });
  });
  await page.clock.install();
  await page.goto("/");
  await tab(page, "Actividad");
  await page
    .getByRole("button", { name: "Iniciar actividad", exact: true })
    .click();
  const emit = async (longitude: number, accuracy = 5) => {
    await page.clock.runFor(2000);
    await page.evaluate(
      ({ longitude, accuracy }) =>
        (
          window as unknown as {
            emitGps: (lon: number, accuracy: number) => void;
          }
        ).emitGps(longitude, accuracy),
      { longitude, accuracy },
    );
  };
  await emit(-77.03);
  await emit(-77.02994);
  await emit(-77.02988);
  await expect(page.locator(".live-summary")).toContainText(/0[.,]01/);
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  const before = (await page.locator(".live-summary").textContent())!;
  await emit(-76.5);
  await page.clock.runFor(10000);
  await expect(page.locator(".live-summary")).toHaveText(before);
  await page.getByRole("button", { name: "Reanudar", exact: true }).click();
  await emit(-77.029, 100);
  await expect(page.getByText(/Precisión GPS baja/)).toBeVisible();
  await emit(-77.029); // new baseline, never adds the unobserved journey
  await expect(page.locator(".live-summary")).toContainText(/0[.,]01/);
  await expect(
    page.getByRole("button", { name: "Acercar mapa" }),
  ).toBeVisible();
  await page.locator(".map-canvas").click({ position: { x: 180, y: 150 } });
  await expect(
    page.getByRole("button", { name: "Quitar destino" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Calcular ruta" }).click();
  await expect(
    page.getByText("Distancia de la ruta", { exact: true }),
  ).toBeVisible();
  const canvas = page.locator(".map-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await page.mouse.move(box!.x + 120, box!.y + 120);
  await page.mouse.down();
  await page.mouse.move(box!.x + 210, box!.y + 180, { steps: 8 });
  await page.mouse.up();
  await expect(
    page.getByRole("checkbox", { name: "Seguir ubicación" }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Centrar en mi ubicación" }).click();
  await expect(
    page.getByRole("checkbox", { name: "Seguir ubicación" }),
  ).toBeChecked();
  await expect(
    page.getByText("Distancia de la ruta", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Quitar destino" }).click();
  await expect(
    page.getByRole("button", { name: "Quitar destino" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Finalizar", exact: true }).click();
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("speedtrack.sessions.v1")!)[0],
  );
  expect(saved.distance).toBeGreaterThan(0.01);
  expect(saved.distance).toBeLessThan(0.02);
  expect(
    saved.measurements.filter(
      (m: { break_before?: boolean }) => m.break_before,
    ),
  ).toHaveLength(2);
});

test("Quechua covers account, navigation, activity and history without Spanish inheritance", async ({
  page,
}) => {
  await mocks(page);
  await page.goto("/");
  await tab(page, "Perfil");
  await page.locator("#language").selectOption("qu");
  await expect(
    page.getByRole("button", { name: "Yupayniykiman yaykuy", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /Rimay yanapaq/ }),
  ).toBeVisible();
  await tab(page, "Kuyuy");
  await expect(
    page.getByRole("heading", { name: "Purinaykita wakichiy" }),
  ).toBeVisible();
  await expect(
    page.getByText("Chayanata maskay", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Qhawarichiy purisqata llamk’achiy" })
    .check();
  await page
    .getByRole("button", { name: "Kuyuyta qallariy", exact: true })
    .click();
  await expect(page.locator(".live-summary")).toContainText(
    "Kunan puriy pacha",
  );
  await page.screenshot({
    path: "test-results/quechua-live-map.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Tukuy", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Kuyuy pisiyachisqa" }),
  ).toBeVisible();
  await tab(page, "Purisqakuna");
  await expect(page.locator(".session-card")).toHaveCount(4);
  await page.reload();
  await expect(page.locator(".bottom-nav")).toContainText("Purisqakuna");
});
