// Set PLAYWRIGHT_MODULE, CHROME, FFMPEG and OUTPUT to local executable paths.
import { pathToFileURL, fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { once } from "node:events";

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  await page.goto(pathToFileURL(fileURLToPath(new URL("stage.html", import.meta.url))).href);
  await page.waitForFunction(() => window.ready);
  const ffmpeg = spawn(
    process.env.FFMPEG,
    [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "image2pipe",
      "-framerate",
      "30",
      "-c:v",
      "mjpeg",
      "-i",
      "-",
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "21",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      process.env.OUTPUT,
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const done = once(ffmpeg, "close");
  for (let frame = 0; frame < 270; frame++) {
    await page.evaluate((time) => window.render(time), frame / 30);
    const image = await page.screenshot({ type: "jpeg", quality: 92 });
    if (!ffmpeg.stdin.write(image)) await once(ffmpeg.stdin, "drain");
  }
  ffmpeg.stdin.end();
  const [code] = await done;
  if (code !== 0) throw new Error(`ffmpeg exited with ${code}`);
} finally {
  await browser.close();
}
