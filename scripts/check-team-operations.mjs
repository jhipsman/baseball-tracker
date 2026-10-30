import { PGlite } from "@electric-sql/pglite";
import { fileURLToPath } from "node:url";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
process.on("uncaughtException", (e) => {
  console.error("DB FIXTURE ERROR", e.message);
  process.exit(1);
});
const db = new PGlite();
await db.exec(`create schema auth;create schema storage;create role anon;create role authenticated;create role service_role bypassrls;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.user',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('app.role',true),''),current_user)$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;`);
const dir = fileURLToPath(new URL("../supabase/migrations", import.meta.url));
for (const file of readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  try {
    await db.exec(
      readFileSync(dir + "/" + file, "utf8").replace(
        "create extension if not exists pgcrypto;",
        "-- PGlite has core gen_random_uuid; production pgcrypto setup is pre-existing.",
      ),
    );
  } catch (e) {
    console.error("MIGRATION FAILED", file, e.message);
    process.exit(1);
  }
}
console.log("All migrations applied to isolated PostgreSQL test engine.");
await db.exec(
  `grant usage on schema public,private,auth to authenticated,service_role;grant select,insert,update,delete on all tables in schema public to authenticated,service_role;grant select on public.schedule_activities to authenticated;`,
);
const org = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002";
const ids = {
  admin: "10000000-0000-4000-8000-000000000001",
  coach: "10000000-0000-4000-8000-000000000002",
  player: "10000000-0000-4000-8000-000000000003",
  parent: "10000000-0000-4000-8000-000000000004",
  outsider: "10000000-0000-4000-8000-000000000005",
  player2: "10000000-0000-4000-8000-000000000006",
};
for (const [name, id] of Object.entries(ids))
  await db.query(
    `insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)values($1,$2,now(),$3::jsonb)`,
    [id, name + "@example.test", JSON.stringify({ full_name: name })],
  );
await db.query(
  `insert into organizations(id,name,slug,owner_id)values($1,'Test Team','test-team',$3),($2,'Other Team','other-team',$3)`,
  [org, other, ids.admin],
);
for (const [name, id] of Object.entries(ids))
  await db.query(
    `insert into org_memberships(org_id,profile_id,role)values($1,$2,$3)on conflict(org_id,profile_id)do update set role=excluded.role`,
    [
      name === "outsider" ? other : org,
      id,
      name === "player2" ? "player" : name === "outsider" ? "admin" : name,
    ],
  );
await db.query(`insert into parent_links(org_id,parent_id,player_id)values($1,$2,$3)`, [
  org,
  ids.parent,
  ids.player,
]);
async function as(name, role = "authenticated") {
  await db.exec("reset role");
  await db.query(`select set_config('app.user',$1,false),set_config('app.role',$2,false)`, [
    ids[name] ?? "",
    role,
  ]);
  await db.exec(`set role ${role}`);
}
async function call(name, args) {
  const params = args.map((_, i) => "$" + (i + 1)).join(",");
  return (await db.query(`select public.${name}(${params}) result`, args)).rows[0].result;
}
const checks = [];
async function check(name, fn) {
  try {
    await fn();
    checks.push(name);
    console.log("PASS", name);
  } catch (e) {
    console.error("FAIL", name, e.message);
    process.exit(1);
  }
}
let event, plan, invoice;
await check("recurring event creation is atomic and dates stay weekly", async () => {
  await as("admin");
  event = await call("create_team_events", [
    org,
    JSON.stringify({ title: "Meeting", date: "2026-11-01", start_time: "17:00", published: true }),
    3,
    false,
  ]);
  const rows = (await db.query("select * from team_events where org_id=$1 order by date", [org]))
    .rows;
  assert.equal(rows.length, 3);
  assert.equal(rows[1].date.toISOString().slice(0, 10), "2026-11-08");
});
await check("players can RSVP for themselves and parents for linked children", async () => {
  await as("player");
  await call("respond_activity", [org, "event", event, ids.player, "yes", null]);
  await as("parent");
  await call("respond_activity", [org, "event", event, ids.player, "maybe", null]);
  await assert.rejects(call("respond_activity", [org, "event", event, ids.player2, "yes", null]));
  await assert.rejects(call("respond_activity", [org, "event", event, ids.player, "yes", true]));
});
await check("staff check-in preserves family RSVP and isolates organizations", async () => {
  await as("coach");
  await call("respond_activity", [org, "event", event, ids.player, null, true]);
  const row = (await db.query("select * from activity_attendance where player_id=$1", [ids.player]))
    .rows[0];
  assert.equal(row.response, "maybe");
  assert.equal(row.checked_in, true);
  await as("outsider");
  await assert.rejects(call("respond_activity", [org, "event", event, ids.player, "no", null]));
  assert.equal((await db.query("select * from team_events where org_id=$1", [org])).rows.length, 0);
});
await check("bulk updates use last-seen versions and reject stale changes", async () => {
  await as("admin");
  const row = (await db.query("select * from schedule_activities where id=$1", [event])).rows[0];
  const items = JSON.stringify([
    { kind: "event", id: event, updatedAt: row.updated_at.toISOString() },
  ]);
  assert.equal(
    await call("update_schedule_activities", [
      org,
      items,
      "reschedule",
      1,
      "18:00",
      "Field 2",
      false,
    ]),
    1,
  );
  await assert.rejects(
    call("update_schedule_activities", [org, items, "cancel", 0, null, null, false]),
  );
  assert.equal(
    (await db.query("select date from team_events where id=$1", [event])).rows[0].date
      .toISOString()
      .slice(0, 10),
    "2026-11-02",
  );
});
await check(
  "a failing bulk batch rolls back earlier changes and sends no notifications",
  async () => {
    await as("admin");
    const row = (await db.query("select * from schedule_activities where id=$1", [event])).rows[0];
    const before = (await db.query("select count(*)::int n from schedule_changes")).rows[0].n;
    await assert.rejects(
      call("update_schedule_activities", [
        org,
        JSON.stringify([
          { kind: "event", id: event, updatedAt: row.updated_at.toISOString() },
          { kind: "event", id: org, updatedAt: row.updated_at.toISOString() },
        ]),
        "cancel",
        0,
        null,
        null,
        true,
      ]),
    );
    assert.equal(
      (await db.query("select count(*)::int n from schedule_changes")).rows[0].n,
      before,
    );
    assert.equal(
      (await db.query("select canceled from team_events where id=$1", [event])).rows[0].canceled,
      false,
    );
  },
);
await check("monthly invoice schedule clamps month ends and is idempotent", async () => {
  await as("admin");
  plan = await call("create_team_payment_plan", [
    org,
    ids.parent,
    ids.player,
    "Spring dues",
    "2027",
    10000,
    3,
    "2027-01-31",
    "request-one",
  ]);
  assert.equal(
    await call("create_team_payment_plan", [
      org,
      ids.parent,
      ids.player,
      "Spring dues",
      "2027",
      10000,
      3,
      "2027-01-31",
      "request-one",
    ]),
    plan,
  );
  const rows = (
    await db.query("select * from team_invoices where plan_id=$1 order by installment_number", [
      plan,
    ])
  ).rows;
  assert.deepEqual(
    rows.map((r) => r.due_date.toISOString().slice(0, 10)),
    ["2027-01-31", "2027-02-28", "2027-03-31"],
  );
  invoice = rows[0].id;
});
await check("offline payment retries do not duplicate money and overpayments fail", async () => {
  await as("admin");
  await call("record_team_payment", [
    org,
    invoice,
    "payment",
    4000,
    "cash",
    "test",
    "",
    "offline-one",
  ]);
  await call("record_team_payment", [
    org,
    invoice,
    "payment",
    4000,
    "cash",
    "test",
    "",
    "offline-one",
  ]);
  assert.equal(
    (await db.query("select paid_cents from team_invoices where id=$1", [invoice])).rows[0]
      .paid_cents,
    4000,
  );
  await assert.rejects(
    call("record_team_payment", [org, invoice, "payment", 7000, "cash", "", "", "too-much"]),
  );
});
await check("families see only their invoices and coaches cannot access billing", async () => {
  await as("parent");
  assert.equal((await db.query("select count(*)::int n from team_invoices")).rows[0].n, 3);
  await assert.rejects(
    call("record_team_payment", [org, invoice, "payment", 100, "cash", "", "", "bad"]),
  );
  await as("coach");
  assert.equal((await db.query("select count(*)::int n from team_invoices")).rows[0].n, 0);
  await as("player2");
  assert.equal((await db.query("select count(*)::int n from team_invoices")).rows[0].n, 0);
});
await check("only service role can apply a verified processor payment", async () => {
  await as("parent");
  await assert.rejects(
    call("apply_team_stripe_payment", [
      "evt1",
      org,
      invoice,
      null,
      6000,
      "pi_one",
      "payment",
      null,
    ]),
  );
  await as("admin", "service_role");
  await call("apply_team_stripe_payment", [
    "evt1",
    org,
    invoice,
    null,
    6000,
    "pi_one",
    "payment",
    230,
  ]);
  assert.equal(
    (await db.query("select paid_cents from team_invoices where id=$1", [invoice])).rows[0]
      .paid_cents,
    10000,
  );
  await call("apply_team_stripe_payment", [
    "evt1",
    org,
    invoice,
    null,
    6000,
    "pi_one",
    "payment",
    230,
  ]);
  await call("apply_team_stripe_payment", [
    "evt2",
    org,
    invoice,
    null,
    6000,
    "pi_one",
    "payment",
    230,
  ]);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from team_payment_transactions where provider_payment_id=$1 and kind=$2",
        ["pi_one", "payment"],
      )
    ).rows[0].n,
    1,
  );
});
await check("cumulative processor refunds are applied only once", async () => {
  await as("admin", "service_role");
  await call("apply_team_stripe_payment", [
    "refund1",
    org,
    null,
    null,
    1000,
    "pi_one",
    "refund",
    null,
  ]);
  await call("apply_team_stripe_payment", [
    "refund2",
    org,
    null,
    null,
    1000,
    "pi_one",
    "refund",
    null,
  ]);
  assert.equal(
    (await db.query("select refunded_cents from team_invoices where id=$1", [invoice])).rows[0]
      .refunded_cents,
    1000,
  );
});
await check("financial recipient filtering is admin-only even for null scope", async () => {
  await as("coach");
  await assert.rejects(call("announcement_recipients", [org, null, true, "overdue"]));
  await assert.rejects(call("announcement_recipients", [org, null, true, null]));
});
await check("import links require an actual player in the same organization", async () => {
  await as("admin");
  await call("import_team_rows", [
    org,
    "roster",
    "leagueapps",
    "2027",
    JSON.stringify([{ key: "name:player", values: { name: "player", jersey: "12" } }]),
  ]);
  const row = (await db.query("select id from team_import_rows where org_id=$1", [org])).rows[0];
  await assert.rejects(call("link_imported_player", [org, row.id, ids.outsider]));
  await call("link_imported_player", [org, row.id, ids.player]);
  assert.equal(
    (await db.query("select player_id from team_import_rows where id=$1", [row.id])).rows[0]
      .player_id,
    ids.player,
  );
});
await check(
  "editing a series changes this and later occurrences and rejects stale versions",
  async () => {
    await as("admin");
    const id = await call("create_team_events", [
      org,
      JSON.stringify({ title: "Weekly", date: "2027-01-01", start_time: "17:00", published: true }),
      3,
      false,
    ]);
    const rows = (
      await db.query(
        "select * from team_events where series_id=(select series_id from team_events where id=$1) order by date",
        [id],
      )
    ).rows;
    const edited = {
      title: "Updated weekly",
      event_type: "meeting",
      date: "2027-01-09",
      start_time: "18:00",
      duration_minutes: 90,
      published: true,
    };
    assert.equal(
      await call("edit_team_event", [
        org,
        rows[1].id,
        rows[1].updated_at.toISOString(),
        JSON.stringify(edited),
        true,
        false,
      ]),
      2,
    );
    const after = (
      await db.query("select title,date from team_events where series_id=$1 order by date", [
        rows[0].series_id,
      ])
    ).rows;
    assert.equal(after[0].title, "Weekly");
    assert.equal(after[2].date.toISOString().slice(0, 10), "2027-01-16");
    await assert.rejects(
      call("edit_team_event", [
        org,
        rows[1].id,
        rows[1].updated_at.toISOString(),
        JSON.stringify(edited),
        true,
        false,
      ]),
    );
  },
);
await check(
  "schedule import matches an existing group and rolls back invalid group batches",
  async () => {
    await as("admin");
    const g = (
      await db.query(
        "insert into player_groups(org_id,name,created_by)values($1,'Varsity',$2)returning id",
        [org, ids.admin],
      )
    ).rows[0].id;
    const row = {
      key: "group-game",
      values: { opponent: "Rivals", date: "2027-04-03", home_away: "home", group: "Varsity" },
    };
    await call("import_team_rows", [org, "schedule", "leagueapps", "2027", JSON.stringify([row])]);
    assert.equal(
      (await db.query("select group_id from games where opponent='Rivals'")).rows[0].group_id,
      g,
    );
    await assert.rejects(
      call("import_team_rows", [
        org,
        "schedule",
        "leagueapps",
        "2027",
        JSON.stringify([
          { ...row, key: "rollback", values: { ...row.values, opponent: "Rollback" } },
          { ...row, key: "bad-group", values: { ...row.values, group: "Unknown" } },
        ]),
      ]),
    );
    assert.equal((await db.query("select id from games where opponent='Rollback'")).rows.length, 0);
  },
);
await check(
  "financial announcements are hidden from other families and nonrecipient coaches",
  async () => {
    await as("admin");
    const a = (
      await db.query(
        "insert into announcements(org_id,author_id,title,body,recipient_ids,audience_scope)values($1,$2,'Private reminder','Open your payments',$3,'overdue')returning id",
        [org, ids.admin, [ids.parent]],
      )
    ).rows[0].id;
    await as("coach");
    assert.equal((await db.query("select id from announcements where id=$1", [a])).rows.length, 0);
    await as("player2");
    assert.equal((await db.query("select id from announcements where id=$1", [a])).rows.length, 0);
    await as("parent");
    assert.equal((await db.query("select id from announcements where id=$1", [a])).rows.length, 1);
  },
);
await check(
  "canceling balances preserves payments and permits a later recorded refund",
  async () => {
    await as("admin");
    const p = await call("create_team_payment_plan", [
      org,
      ids.parent,
      ids.player,
      "Cancel test",
      "2027",
      10000,
      2,
      "2027-01-31",
      "cancel-plan",
    ]);
    const i = (
      await db.query("select id from team_invoices where plan_id=$1 order by installment_number", [
        p,
      ])
    ).rows[0].id;
    await call("record_team_payment", [org, i, "payment", 2500, "cash", "", "", "cancel-payment"]);
    await call("cancel_team_payment_plan", [org, p]);
    await assert.rejects(
      call("record_team_payment", [org, i, "payment", 100, "cash", "", "", "void-payment"]),
    );
    await call("record_team_payment", [org, i, "refund", 1000, "cash", "", "", "void-refund"]);
    const row = (await db.query("select * from team_invoices where id=$1", [i])).rows[0];
    assert.equal(row.status, "void");
    assert.equal(row.paid_cents, 2500);
    assert.equal(row.refunded_cents, 1000);
  },
);
console.log(checks.length + " database scenarios passed.");
await db.close();
