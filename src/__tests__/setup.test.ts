import { describe, it, expect } from "vitest";

describe("Project setup", () => {
  it("should have vitest configured correctly", () => {
    expect(true).toBe(true);
  });

  it("should resolve path aliases", async () => {
    const page = await import("@/app/page");
    expect(page.default).toBeDefined();
  });
});
