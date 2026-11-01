import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { generateDemo } from "../data/demo";
import { importActivity } from "./activityRepository";
it("executes the migration and isolates all tables and atomic RPC across two users", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to authenticated,anon;
      grant execute on function auth.uid() to authenticated,anon;`);
    await db.exec(
      readFileSync(
        new URL(
          "../../supabase/migrations/202610270001_speedtrack_v2.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const alice = "11111111-1111-4111-8111-111111111111",
      bob = "22222222-2222-4222-8222-222222222222";
    await db.query("insert into auth.users(id) values ($1),($2)", [alice, bob]);
    await db.exec(
      `set role authenticated; set request.jwt.claim.sub='${alice}';`,
    );
    const a = { ...generateDemo("vehicle"), user_id: alice };
    await db.query("select public.save_activity($1::jsonb)", [
      JSON.stringify(a),
    ]);
    await db.query("update public.profiles set name=$2 where id=$1", [
      alice,
      "Alice",
    ]);
    await db.query("insert into public.user_settings values ($1,$2)", [
      alice,
      "{}",
    ]);
    await db.exec(`set request.jwt.claim.sub='${bob}'`);
    for (const table of [
      "profiles",
      "sessions",
      "measurements",
      "splits",
      "events",
      "user_settings",
    ]) {
      const rows = (
        await db.query<{ id?: string }>(`select * from public.${table}`)
      ).rows;
      if (table === "profiles") expect(rows.map((r) => r.id)).toEqual([bob]);
      else expect(rows).toHaveLength(0);
    }
    await expect(
      db.query("select public.save_activity($1::jsonb)", [JSON.stringify(a)]),
    ).rejects.toThrow();
    await expect(
      db.query("select public.save_activity($1::jsonb)", [
        JSON.stringify({ ...a, user_id: bob }),
      ]),
    ).rejects.toThrow();
    await expect(
      db.query("insert into public.measurements values ($1,$2,$3,$4)", [
        "attack",
        a.id,
        bob,
        "{}",
      ]),
    ).rejects.toThrow();
    await expect(
      db.query("insert into public.profiles values ($1,$2)", [alice, "attack"]),
    ).rejects.toThrow();
    await db.exec(
      `delete from public.sessions; set request.jwt.claim.sub='${alice}';`,
    );
    expect((await db.query("select * from public.sessions")).rows).toHaveLength(
      1,
    );
    await db.query("select public.save_activity($1::jsonb)", [
      JSON.stringify(a),
    ]);
    expect(
      (await db.query("select * from public.measurements")).rows,
    ).toHaveLength(a.measurements.length);
    // The same local activity can be explicitly imported by two accounts.
    // Check actual SQL primary keys as well as RLS, including child rows.
    for (const owner of [alice, bob]) {
      await db.exec(`set request.jwt.claim.sub='${owner}'`);
      const imported = await importActivity(a, owner);
      for (let retry = 0; retry < 2; retry++) {
        await db.query("select public.save_activity($1::jsonb)", [
          JSON.stringify(imported),
        ]);
      }
      const rows = (
        await db.query<{ id: string }>("select id from public.sessions")
      ).rows;
      expect(rows.filter((row) => row.id === imported.id)).toHaveLength(1);
      expect(
        (
          await db.query(
            "select * from public.measurements where session_id=$1",
            [imported.id],
          )
        ).rows,
      ).toHaveLength(a.measurements.length);
    }
    await db.exec("reset role; set role anon;");
    await expect(db.query("select * from public.sessions")).rejects.toThrow();
  } finally {
    await db.close();
  }
}, 30000);
