import { describe, expect, it } from "vitest";

describe("harness unitário", () => {
  it("preserva valores e tipos primitivos", () => {
    const result = { ready: true, count: 1 } as const;

    expect(result).toEqual({ ready: true, count: 1 });
  });
});
