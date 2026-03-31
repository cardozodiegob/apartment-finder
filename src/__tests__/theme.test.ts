import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const globalsCSS = fs.readFileSync(
  path.resolve(__dirname, "../app/globals.css"),
  "utf-8"
);

describe("Tailwind CSS Theme Configuration", () => {
  describe("Dark mode setup", () => {
    it("should use class-based dark mode via @custom-variant", () => {
      expect(globalsCSS).toContain("@custom-variant dark");
      expect(globalsCSS).toContain(".dark");
    });

    it("should define dark mode CSS custom properties", () => {
      // Check that .dark block exists with theme tokens
      const darkBlock = globalsCSS.match(/\.dark\s*\{[\s\S]+?\}/);
      expect(darkBlock).not.toBeNull();
      expect(darkBlock![0]).toContain("--background");
      expect(darkBlock![0]).toContain("--foreground");
    });
  });

  describe("Navy color palette", () => {
    const navyShades = [
      "navy-50",
      "navy-100",
      "navy-200",
      "navy-300",
      "navy-400",
      "navy-500",
      "navy-600",
      "navy-700",
      "navy-800",
      "navy-900",
      "navy-950",
    ];

    it.each(navyShades)("should define color %s", (shade) => {
      expect(globalsCSS).toContain(`--color-${shade}`);
    });
  });

  describe("Glass effect tokens", () => {
    it("should define glass color tokens", () => {
      expect(globalsCSS).toContain("--color-glass-white");
      expect(globalsCSS).toContain("--color-glass-dark");
      expect(globalsCSS).toContain("--color-glass-border-light");
      expect(globalsCSS).toContain("--color-glass-border-dark");
    });

    it("should define backdrop blur tokens", () => {
      expect(globalsCSS).toContain("--backdrop-blur-glass-sm");
      expect(globalsCSS).toContain("--backdrop-blur-glass:");
      expect(globalsCSS).toContain("--backdrop-blur-glass-lg");
      expect(globalsCSS).toContain("--backdrop-blur-glass-xl");
    });
  });

  describe("Glassmorphism component classes", () => {
    it("should define .glass base class with backdrop-filter", () => {
      expect(globalsCSS).toMatch(/\.glass\s*\{[\s\S]*?backdrop-filter/);
    });

    it("should define .glass-card class", () => {
      expect(globalsCSS).toMatch(/\.glass-card\s*\{[\s\S]*?backdrop-filter/);
      expect(globalsCSS).toMatch(/\.glass-card\s*\{[\s\S]*?border-radius/);
    });

    it("should define .glass-nav class", () => {
      expect(globalsCSS).toMatch(/\.glass-nav\s*\{[\s\S]*?backdrop-filter/);
    });

    it("should include -webkit-backdrop-filter for Safari support", () => {
      expect(globalsCSS).toContain("-webkit-backdrop-filter");
    });
  });

  describe("Theme CSS custom properties", () => {
    it("should define light mode tokens in :root", () => {
      const rootBlock = globalsCSS.match(/:root\s*\{[\s\S]+?\}/);
      expect(rootBlock).not.toBeNull();
      expect(rootBlock![0]).toContain("--background");
      expect(rootBlock![0]).toContain("--foreground");
      expect(rootBlock![0]).toContain("--glass-bg");
      expect(rootBlock![0]).toContain("--glass-border");
    });

    it("should define dark mode tokens in .dark", () => {
      const darkBlock = globalsCSS.match(/\.dark\s*\{[\s\S]+?\}/);
      expect(darkBlock).not.toBeNull();
      expect(darkBlock![0]).toContain("--background");
      expect(darkBlock![0]).toContain("--foreground");
      expect(darkBlock![0]).toContain("--glass-bg");
      expect(darkBlock![0]).toContain("--glass-border");
    });
  });

  describe("Tailwind v4 @theme directive", () => {
    it("should use @theme block for custom tokens", () => {
      expect(globalsCSS).toContain("@theme {");
    });

    it("should import tailwindcss", () => {
      expect(globalsCSS).toContain('@import "tailwindcss"');
    });
  });
});
