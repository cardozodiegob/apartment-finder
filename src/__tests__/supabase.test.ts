import { describe, it, expect, vi, beforeAll } from "vitest";

// Set env vars before any Supabase module is imported
beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
});

describe("Supabase module exports", () => {
  it("should export browser client", async () => {
    const { supabase } = await import("@/lib/supabase/client");
    expect(supabase).toBeDefined();
    expect(typeof supabase.auth).toBe("object");
    expect(typeof supabase.storage).toBe("object");
  });

  it("should export server client", async () => {
    const { supabaseAdmin } = await import("@/lib/supabase/server");
    expect(supabaseAdmin).toBeDefined();
    expect(typeof supabaseAdmin.auth).toBe("object");
    expect(typeof supabaseAdmin.storage).toBe("object");
  });

  it("should export LISTING_PHOTOS_BUCKET constant", async () => {
    const { LISTING_PHOTOS_BUCKET } = await import("@/lib/supabase/storage");
    expect(LISTING_PHOTOS_BUCKET).toBe("listing-photos");
  });

  it("should export auth types from barrel", async () => {
    const barrel = await import("@/lib/supabase");
    expect(barrel.supabase).toBeDefined();
    expect(barrel.supabaseAdmin).toBeDefined();
    expect(barrel.LISTING_PHOTOS_BUCKET).toBe("listing-photos");
  });

  it("should export type definitions that compile correctly", async () => {
    // Verify the type module can be imported without errors
    const types = await import("@/lib/supabase/types");
    expect(types).toBeDefined();
  });
});
