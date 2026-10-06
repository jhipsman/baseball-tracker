import { afterEach, describe, expect, it, vi } from "vitest";
import { uuid } from "./uuid";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuid", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses crypto.randomUUID when available", () => {
    expect(uuid()).toMatch(V4);
  });

  it("falls back to getRandomValues in insecure contexts", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
    });
    const ids = new Set(Array.from({ length: 1000 }, uuid));
    expect(ids.size).toBe(1000);
    for (const id of ids) expect(id).toMatch(V4);
  });
});
