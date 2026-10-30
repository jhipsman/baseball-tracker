import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Night mode remaps palette shades in globals.css. A very light (50–200) or very
// dark (700–950) shade with no Night version stays as-is and ends up unreadable
// (dark text on a dark card, or a glaring pale panel). Mid shades read in both.
const CSS = readFileSync(join(__dirname, "globals.css"), "utf8");
const dark = CSS.slice(CSS.indexOf('[data-theme="dark"]'));
const FIXED = new Set(["neutral", "white", "black"]); // stay dark/light on purpose

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx|ts)$/.test(f) ? [p] : [];
  });
}

describe("Night mode palette", () => {
  it("has a Night version of every light/dark shade the app uses", () => {
    const used = new Set<string>();
    for (const f of files(join(__dirname, ".."))) {
      for (const m of readFileSync(f, "utf8").matchAll(
        /\b(?:text|bg|ring|border|from|to|via|fill|stroke|outline|divide|shadow)-([a-z]+)-(\d{2,3})\b/g,
      )) {
        const [family, shade] = [m[1], Number(m[2])];
        if (FIXED.has(family) || (shade > 200 && shade < 700)) continue;
        used.add(`${family}-${shade}`);
      }
    }
    const missing = [...used].filter((c) => !dark.includes(`--color-${c}:`)).sort();
    expect(missing).toEqual([]);
  });
});
