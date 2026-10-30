// Captures crisp app screens from a fresh demo team for the commercial.
import { chromium } from "playwright-core";
const BASE = "http://localhost:3000";
const OUT = new URL("./shots/", import.meta.url).pathname;
const ts = Date.now();
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { if (!localStorage.getItem("theme")) localStorage.setItem("theme", "dark"); });
const page = await ctx.newPage(); page.setDefaultTimeout(60000);
const hidePreview = () => page.addStyleTag({ content: "div[role=status].sticky{display:none!important}" });
const settle = async () => { await page.waitForLoadState("networkidle"); await page.waitForTimeout(500); };
const shot = async (name, opts = {}) => { await settle(); await hidePreview(); await page.waitForTimeout(150); await page.screenshot({ path: OUT + name + ".png", ...opts }); console.log("shot", name); };
const setTheme = async (t) => { await page.evaluate((t) => { localStorage.setItem("theme", t); document.documentElement.dataset.theme = t; }, t); };

await page.goto(`${BASE}/signup`);
await page.fill("input[name=full_name]", "Mike Torres");
await page.fill("input[name=email]", `coachmike${ts}@example.com`);
await page.fill("input[name=password]", "password123");
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForURL(`${BASE}/onboarding`);
await page.fill("input[name=name]", `Torres Baseball ${ts}`);
await page.getByRole("button", { name: /create/i }).click();
await page.waitForURL(`${BASE}/`);
await page.goto(`${BASE}/settings`);
await page.getByRole("button", { name: "Create demo team" }).click();
await page.waitForURL(`${BASE}/`, { timeout: 120000 });

// ---- desktop (dark)
await page.goto(`${BASE}/`); await shot("desk-dashboard");
await page.goto(`${BASE}/throwing`); await shot("desk-health");
await page.goto(`${BASE}/programs`);
const bullpen = await page.locator("a[href^='/programs/']", { hasText: "Bullpen" }).first().getAttribute("href");
await page.goto(`${BASE}${bullpen}`); await shot("desk-program");
await page.goto(`${BASE}/calendar?view=month`); await shot("desk-calendar");
await page.goto(`${BASE}/dues`); await shot("desk-dues");
await page.goto(`${BASE}/stats`); await shot("desk-stats");
await setTheme("light");
await page.goto(`${BASE}/`); await shot("desk-dashboard-light");
await page.goto(`${BASE}/throwing`); await shot("desk-health-light");
await setTheme("dark");

// ---- phone: live scorer (coach)
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/games`);
const gameHref = await page.locator("a[href^='/games/']", { hasText: "Lakeside Hawks" }).first().getAttribute("href");
await page.goto(`${BASE}${gameHref}`);
await page.getByRole("link", { name: /Score at-bat by at-bat/ }).click();
await page.waitForURL(/\/live$/);
for (const n of ["Lucas Chen", "Jackson Reed", "Carter Hayes", "Aiden Murphy", "Ethan Brooks", "Logan Price", "Diego Santos", "Mason Rivera", "Ryan Kim"]) {
  const b = page.getByRole("button", { name: `+ ${n}` });
  if (await b.count()) await b.click();
}
await page.getByLabel("Starting pitcher").selectOption({ label: "Owen Walsh" });
await page.getByRole("button", { name: "Start scoring" }).click();
const W = page.getByRole("region", { name: "Live game scoring" });
await W.waitFor();
await shot("phone-live-0");
const pitch = async (label) => {
  await W.getByRole("button", { name: new RegExp(`^\\S+\\s*${label}$`) }).click();
  await page.waitForFunction(() => !document.body.innerText.includes("Saving…"), null, { timeout: 15000 });
};
let i = 1;
for (const p of ["Called strike", "Ball", "Swinging strike", "Foul", "Ball"]) { await pitch(p); await shot(`phone-live-${i++}`); }

// ---- phone: player + parent via View as (read-only)
const viewAs = async (name) => {
  await page.goto(`${BASE}/view-as/exit`);
  await page.goto(`${BASE}/settings`);
  await page.locator("#preview").getByRole("link", { name: new RegExp(`^${name}`) }).click();
  await page.waitForURL(/\/(player|parent)$/);
};
await viewAs("Owen Walsh");
await shot("phone-player");
await setTheme("light"); await page.reload(); await shot("phone-player-light"); await setTheme("dark");
const start = page.getByRole("link", { name: /Start workout|View \/ edit log/ }).first();
if (await start.count()) { await page.goto(BASE + (await start.getAttribute("href"))); await shot("phone-workout"); }
await page.goto(`${BASE}/player/throwing`); await shot("phone-player-health");
await viewAs("Priya Patel");
await shot("phone-parent");
await page.goto(`${BASE}/parent/schedule`); await shot("phone-parent-schedule");
await page.goto(`${BASE}/view-as/exit`);
await browser.close();
