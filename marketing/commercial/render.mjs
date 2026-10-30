// node render.mjs stills t1,t2,...   |   node render.mjs video out.mp4 [fps]
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const dir = new URL(".", import.meta.url).pathname;
const [mode, arg, fpsArg] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--allow-file-access-from-files"] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto("file://" + dir + "stage.html");
await page.evaluate(() => window.ready);
if (mode === "stills") {
  for (const t of arg.split(",").map(Number)) {
    await page.evaluate((t) => window.render(t), t);
    await page.screenshot({ path: `${dir}still-${t}.jpg`, type: "jpeg", quality: 80 });
  }
} else {
  const fps = Number(fpsArg ?? 30);
  const total = Math.round((await page.evaluate(() => window.DURATION)) * fps);
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", arg], { stdio: ["pipe", "inherit", "inherit"] });
  for (let f = 0; f < total; f++) {
    await page.evaluate((t) => window.render(t), f / fps);
    const buf = await page.screenshot({ type: "jpeg", quality: 94 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % 150 === 0) console.log(`frame ${f}/${total}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
}
await browser.close();
