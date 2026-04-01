import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable inside .env.local"
  );
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

/** Module-level flag: admin seed runs at most once per lifecycle */
let adminSeeded = false;

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/**
 * Attempt MongoDB connection with retry logic.
 * Retries up to 3 times with exponential backoff (1s, 2s, 4s).
 */
async function connectWithRetry(): Promise<typeof mongoose> {
  const opts: mongoose.ConnectOptions = {
    bufferCommands: false,
    maxPoolSize: 10,
    connectTimeoutMS: 5000,
  };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await mongoose.connect(MONGODB_URI!, opts);
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        console.error(
          `MongoDB connection failed after ${MAX_RETRIES} attempts`,
          err
        );
        throw err;
      }
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(
        `MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed, retrying in ${delay}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Unreachable, but satisfies TypeScript
  throw new Error("MongoDB connection failed");
}

/**
 * Run admin seed exactly once. On failure, log and skip — do not retry.
 */
async function runAdminSeedOnce(): Promise<void> {
  if (adminSeeded) return;
  // Set flag before calling to prevent re-entry from concurrent requests
  adminSeeded = true;
  try {
    const { seedInitialAdmin } = await import("@/lib/api/admin-middleware");
    await seedInitialAdmin();
  } catch (err) {
    console.error("Admin seed error (will not retry):", err);
    // Flag stays true — no retry on subsequent requests
  }
}

async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) {
    runAdminSeedOnce();
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = connectWithRetry();
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    // Reset promise so next call can retry fresh
    cached.promise = null;
    throw err;
  }

  runAdminSeedOnce();

  return cached.conn;
}

export default dbConnect;
