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

let adminSeeded = false;

async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) {
    if (!adminSeeded) {
      adminSeeded = true;
      const { seedInitialAdmin } = await import("@/lib/api/admin-middleware");
      seedInitialAdmin().catch((err) => console.error("Admin seed error:", err));
    }
    return cached.conn;
  }

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((m) => m);
  }

  cached.conn = await cached.promise;

  if (!adminSeeded) {
    adminSeeded = true;
    const { seedInitialAdmin } = await import("@/lib/api/admin-middleware");
    seedInitialAdmin().catch((err) => console.error("Admin seed error:", err));
  }

  return cached.conn;
}

export default dbConnect;
