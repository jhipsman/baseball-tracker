// Close-up captures for the v2 commercial (coaches · organizations · parents).
import { chromium } from "playwright-core";
const BASE = "http://localhost:3000";
const OUT = new URL("./shots2/", import.meta.url).pathname;
const ts = Date.now();
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  if (!localStorage.getItem("theme")) localStorage.setItem("theme", "dark");
});
const page = await ctx.newPage();
page.setDefaultTimeout(60000);
const prep = async () => {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
  await page.addStyleTag({ content: "div[role=status].sticky{display:none!important} nextjs-portal{display:none!important}" });
  await page.waitForTimeout(100);
};
const full = async (name) => {
  await prep();
  await page.screenshot({ path: OUT + name + ".png" });
  console.log("full", name);
};
/** Crisp close-up of an element (or the box spanning two), with padding. */
const focus = async (name, a, b = a, pad = 16, maxH = 1400) => {
  try {
    await prep();
    await a.first().scrollIntoViewIfNeeded();
    const r1 = await a.first().boundingBox(), r2 = await b.first().boundingBox();
    const x = Math.max(0, Math.min(r1.x, r2.x) - pad), y = Math.max(0, Math.min(r1.y, r2.y) - pad);
    const w = Math.max(r1.x + r1.width, r2.x + r2.width) - x + pad;
    const h = Math.min(maxH, Math.max(r1.y + r1.height, r2.y + r2.height) - y + pad);
    await page.screenshot({ path: OUT + name + ".png", clip: { x, y, width: w, height: h }, fullPage: true });
    console.log("focus", name, Math.round(w), Math.round(h));
  } catch (e) {
    console.log("FOCUS FAILED", name, e.message.split("\n")[0]);
  }
};
const theme = async (t) =>
  page.evaluate((t) => {
    localStorage.setItem("theme", t);
    document.documentElement.dataset.theme = t;
  }, t);

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
const main = page.locator("main");

// ---- coach / org desktop
await page.goto(`${BASE}/`);
await full("dash");
await focus("dash-top", main.getByText(/throwing alert/), page.getByTestId("next-game"));
await page.goto(`${BASE}/calendar?view=month`);
await full("calendar");
await page.goto(`${BASE}/games`);
await page.getByRole("link", { name: "Results" }).click().catch(() => {});
await full("games-results");
await page.goto(`${BASE}/throwing`);
await full("health");
await focus("health-alerts", main.locator("section", { hasText: "Alerts" }).first());
await focus("health-board", main.locator("table").first(), main.locator("table").first(), 8, 1100);
await page.goto(`${BASE}/programs`);
const bullpen = await page.locator("a[href^='/programs/']", { hasText: "Bullpen" }).first().getAttribute("href");
await page.goto(`${BASE}${bullpen}`);
await full("program");
await focus("program-builds", main.locator("section", { hasText: "How it builds" }));
await focus("program-players", main.locator("section", { hasText: "Players on this program" }));
await page.goto(`${BASE}/stats`);
await full("stats");
await focus("stats-table", main.locator("table").first(), main.locator("table").first(), 8, 900);
await page.goto(`${BASE}/dues`);
await full("dues");
await focus("dues-totals", main.getByText("Outstanding", { exact: true }).locator("xpath=ancestor::div[contains(@class,'grid')][1]"));
await page.goto(`${BASE}/messages`);
await full("messages");
await page.goto(`${BASE}/imports`);
await full("imports");
await page.goto(`${BASE}/settings`);
await full("settings");
await theme("light");
await page.goto(`${BASE}/`);
await full("dash-light");
await theme("dark");

// ---- live game: coach scores a few pitches on the phone
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
await full("phone-live-0");
let i = 1;
for (const p of ["Called strike", "Ball", "Swinging strike", "Foul", "Ball"]) {
  await W.getByRole("button", { name: new RegExp(`^\\S+\\s*${p}$`) }).click();
  await page.waitForFunction(() => !document.body.innerText.includes("Saving…"), null, { timeout: 15000 });
  await full(`phone-live-${i++}`);
}
const gameId = gameHref.split("/")[2];

// ---- parents & players (read-only preview)
const viewAs = async (name) => {
  await page.goto(`${BASE}/view-as/exit`);
  await page.goto(`${BASE}/settings`);
  await page.locator("#preview").getByRole("link", { name: new RegExp(`^${name}`) }).click();
  await page.waitForURL(/\/(player|parent)$/);
};
await viewAs("Priya Patel");
await full("phone-parent");
await page.goto(`${BASE}/parent/games/${gameId}`);
await full("phone-parent-live");
await page.goto(`${BASE}/parent/schedule`);
await full("phone-parent-schedule");
await page.goto(`${BASE}/payments`);
await full("phone-parent-dues");
await page.goto(`${BASE}/parent/stats`);
await full("phone-parent-stats");
await viewAs("Owen Walsh");
await full("phone-player");
await theme("light");
await page.reload();
await full("phone-player-light");
await theme("dark");
const start = page.getByRole("link", { name: /Start workout|View \/ edit log/ }).first();
if (await start.count()) {
  await page.goto(BASE + (await start.getAttribute("href")));
  await full("phone-workout");
}
await page.goto(`${BASE}/view-as/exit`);
await browser.close();
