import { describe, expect, it } from "vitest";
import { demoSearchUrl, parseDemoVideo, parseStartTime } from "./exercise-video";

// Placeholder IDs in the right shape; they don't point at real videos.
const ID = "AbCdEfGhI_-";
const embed = (q = "") => `https://www.youtube-nocookie.com/embed/${ID}?rel=0&playsinline=1${q}`;

describe("parseStartTime", () => {
  it("reads seconds and h/m/s forms", () => {
    expect(parseStartTime("90")).toBe(90);
    expect(parseStartTime("90s")).toBe(90);
    expect(parseStartTime("1m30s")).toBe(90);
    expect(parseStartTime("1h2m3s")).toBe(3723);
    expect(parseStartTime("abc")).toBeNull();
    expect(parseStartTime("")).toBeNull();
    expect(parseStartTime("0")).toBeNull();
  });
});

describe("parseDemoVideo — YouTube", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`, embed()],
    [`https://youtube.com/watch?v=${ID}&t=1m5s`, embed("&start=65")],
    [`https://m.youtube.com/watch?v=${ID}&feature=share`, embed()],
    [`https://youtu.be/${ID}`, embed()],
    [`https://youtu.be/${ID}?t=42`, embed("&start=42")],
    [`https://www.youtube.com/embed/${ID}?start=10`, embed("&start=10")],
    [`https://www.youtube-nocookie.com/embed/${ID}`, embed()],
    [`https://www.youtube.com/live/${ID}`, embed()],
    [`youtube.com/watch?v=${ID}`, embed()],
    [`http://www.youtube.com/watch?v=${ID}#t=30`, embed("&start=30")],
  ])("%s", (input, expected) => {
    const v = parseDemoVideo(input);
    expect(v?.kind).toBe("youtube");
    expect(v && "embedUrl" in v ? v.embedUrl : null).toBe(expected);
  });

  it("marks shorts as vertical", () => {
    const v = parseDemoVideo(`https://www.youtube.com/shorts/${ID}`);
    expect(v).toMatchObject({ kind: "youtube", vertical: true, embedUrl: embed() });
  });

  it("rejects malformed ids and other YouTube pages", () => {
    expect(parseDemoVideo("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(parseDemoVideo(`https://www.youtube.com/watch?v=${ID}"><script>`)).toBeNull();
    expect(parseDemoVideo("https://www.youtube.com/@somechannel")).toBeNull();
    expect(parseDemoVideo("https://www.youtube.com/results?search_query=squat")).toBeNull();
  });
});

describe("parseDemoVideo — Vimeo", () => {
  it.each([
    ["https://vimeo.com/123456789", "https://player.vimeo.com/video/123456789"],
    [
      "https://vimeo.com/123456789/abcdef1234",
      "https://player.vimeo.com/video/123456789?h=abcdef1234",
    ],
    ["https://vimeo.com/channels/staffpicks/123456", "https://player.vimeo.com/video/123456"],
    [
      "https://player.vimeo.com/video/987654?h=abc123",
      "https://player.vimeo.com/video/987654?h=abc123",
    ],
  ])("%s", (input, expected) => {
    const v = parseDemoVideo(input);
    expect(v?.kind).toBe("vimeo");
    expect(v && "embedUrl" in v ? v.embedUrl : null).toBe(expected);
  });

  it("rejects non-video Vimeo pages", () => {
    expect(parseDemoVideo("https://vimeo.com/about")).toBeNull();
    expect(parseDemoVideo("https://player.vimeo.com/other/123")).toBeNull();
  });
});

describe("parseDemoVideo — direct files", () => {
  it("accepts https mp4/webm only", () => {
    expect(parseDemoVideo("https://cdn.example.com/demos/squat.mp4")).toEqual({
      kind: "file",
      src: "https://cdn.example.com/demos/squat.mp4",
      vertical: false,
    });
    expect(parseDemoVideo("http://cdn.example.com/squat.mp4")).toBeNull();
    expect(parseDemoVideo("https://cdn.example.com/squat.mov")).toBeNull();
  });
});

describe("parseDemoVideo — rejects unsafe or unknown links", () => {
  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(document.cookie)//youtube.com/watch?v=AbCdEfGhI_-",
    "data:text/html,<script>alert(1)</script>",
    "https://evil.com/watch?v=AbCdEfGhI_-",
    "https://youtube.com.evil.com/watch?v=AbCdEfGhI_-",
    "https://notyoutube.com/watch?v=AbCdEfGhI_-",
    "https://user:pass@www.youtube.com/watch?v=AbCdEfGhI_-",
    "https://www.youtube.com:8443/watch?v=AbCdEfGhI_-",
    "ftp://vimeo.com/123",
    "",
    "   ",
    null,
    undefined,
    "https://www.youtube.com/watch?v=AbCdEfGhI_-&x=" + "a".repeat(600),
  ])("%s", (input) => {
    expect(parseDemoVideo(input)).toBeNull();
  });
});

describe("demoSearchUrl", () => {
  it("builds a YouTube search for the exercise", () => {
    expect(demoSearchUrl("Pro Agility (5-10-5)")).toBe(
      "https://www.youtube.com/results?search_query=Pro+Agility+(5-10-5)+exercise+demo",
    );
    expect(demoSearchUrl("A&B")).toContain("A%26B+exercise+demo");
  });
});
