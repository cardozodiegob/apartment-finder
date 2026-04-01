import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const version = process.env.npm_package_version ?? "0.1.0";
  const timestamp = new Date().toISOString();

  // Check MongoDB connection status
  // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const mongoReady = mongoose.connection.readyState === 1;
  const mongodb = mongoReady ? "connected" : "disconnected";

  // Check Supabase reachability — the call will return an error (invalid token)
  // but that proves the service is reachable and responding.
  let supabase: "reachable" | "unreachable" = "unreachable";
  try {
    const { error } = await supabaseAdmin.auth.getUser("health-check");
    // An auth error (e.g. "invalid token") means Supabase responded — it's reachable.
    // Only a network-level exception means unreachable.
    supabase = error && error.message?.includes("fetch") ? "unreachable" : "reachable";
  } catch {
    // Network error — Supabase is unreachable
    supabase = "unreachable";
  }

  // Determine overall status
  let status: "healthy" | "degraded" | "unhealthy";
  if (mongoReady && supabase === "reachable") {
    status = "healthy";
  } else if (!mongoReady) {
    status = "unhealthy";
  } else {
    status = "degraded";
  }

  const body = { status, mongodb, supabase, version, timestamp };
  const httpStatus = status === "unhealthy" ? 503 : 200;

  return NextResponse.json(body, { status: httpStatus });
}
