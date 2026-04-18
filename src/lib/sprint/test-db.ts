/**
 * Sprint runner — isolated test MongoDB lifecycle.
 *
 * Creates and drops a per-sprint database named `apartment_finder_sprint_<sprintId>`
 * using a dedicated mongoose connection so the production connection pool is
 * never touched. All destructive operations are guarded by a name-prefix
 * assertion so there is no path to drop a non-sprint database through this
 * module.
 *
 * Requirements: 12.1, 12.3, 12.4
 */

import mongoose, { type Connection } from "mongoose";

// ---------------------------------------------------------------------------
// Public constants and types
// ---------------------------------------------------------------------------

/**
 * Required prefix for every sprint-owned database. `dropTestDatabase` and
 * `createTestDatabase` both assert the target db name starts with this.
 */
export const SPRINT_DB_PREFIX = "apartment_finder_sprint_";

// ---------------------------------------------------------------------------
// Name / URI helpers (pure — exported for testability)
// ---------------------------------------------------------------------------

/**
 * Build the sprint-owned database name for a given sprint id.
 *
 * Lower-cases the id so the name is stable regardless of how the caller
 * stringifies an ObjectId. MongoDB database names are case-sensitive so we
 * pick one canonical form.
 */
export function buildTestDbName(sprintId: string): string {
  const trimmed = String(sprintId).trim().toLowerCase();
  if (trimmed === "") {
    throw new Error("buildTestDbName: sprintId must be a non-empty string");
  }
  return `${SPRINT_DB_PREFIX}${trimmed}`;
}

/**
 * Replace the database path component of a MongoDB URI with the sprint db.
 *
 * Supports `mongodb://` and `mongodb+srv://` URIs with optional query
 * string. Falls back to appending `/<dbName>` when the URI has no path.
 */
export function buildTestMongoUri(baseUri: string, sprintId: string): string {
  const dbName = buildTestDbName(sprintId);
  const trimmed = String(baseUri).trim();
  if (trimmed === "") {
    throw new Error("buildTestMongoUri: baseUri must be a non-empty string");
  }

  // Split off any query string; mongo URIs keep it as `?opts` after the db.
  const queryIdx = trimmed.indexOf("?");
  const before = queryIdx === -1 ? trimmed : trimmed.slice(0, queryIdx);
  const query = queryIdx === -1 ? "" : trimmed.slice(queryIdx);

  // Identify the scheme (mongodb:// or mongodb+srv://) and strip it so we
  // can split host/path cleanly.
  const schemeMatch = before.match(/^(mongodb(?:\+srv)?:\/\/)(.*)$/i);
  if (!schemeMatch) {
    throw new Error(
      `buildTestMongoUri: unrecognized MongoDB URI scheme in "${baseUri}"`,
    );
  }
  const scheme = schemeMatch[1];
  const rest = schemeMatch[2];

  // The path starts at the first `/` after the host(:port[,host:port...]).
  // Credentials (`user:pw@`) may contain `/` so split after the `@` if any.
  const atIdx = rest.lastIndexOf("@");
  const hostStart = atIdx === -1 ? 0 : atIdx + 1;
  const slashIdx = rest.indexOf("/", hostStart);
  const hostSegment = slashIdx === -1 ? rest : rest.slice(0, slashIdx);

  return `${scheme}${hostSegment}/${dbName}${query}`;
}

/** Guard: refuse to touch any database that doesn't carry the sprint prefix. */
function assertSprintDbName(dbName: string): void {
  if (!dbName.startsWith(SPRINT_DB_PREFIX)) {
    throw new Error(
      `Refusing to operate on database "${dbName}": only names starting ` +
        `with "${SPRINT_DB_PREFIX}" are allowed by the sprint runner.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Connection helpers
// ---------------------------------------------------------------------------

/**
 * Open a short-lived mongoose connection for administrative ops against the
 * sprint-owned database. The caller MUST `await connection.close()` when
 * done. We deliberately use `createConnection` (not the global `connect`)
 * so the app's production connection pool is untouched — see design §
 * "Isolated test app instance as a child process".
 */
async function openSprintConnection(sprintUri: string): Promise<Connection> {
  const connection = mongoose.createConnection(sprintUri, {
    bufferCommands: false,
    maxPoolSize: 2,
    connectTimeoutMS: 5000,
    serverSelectionTimeoutMS: 5000,
  });
  await connection.asPromise();
  return connection;
}

// ---------------------------------------------------------------------------
// Public lifecycle API
// ---------------------------------------------------------------------------

/**
 * Ensure the sprint-owned database exists. MongoDB creates databases
 * lazily on first write, so we issue a trivial `ping`/`stats` command to
 * materialize the database handle and verify connectivity. Returns the
 * resolved URI so callers can reuse it for the child test instance's
 * `MONGODB_URI` env.
 */
export async function createTestDatabase(
  sprintId: string,
  baseUri: string,
): Promise<{ uri: string; dbName: string }> {
  const uri = buildTestMongoUri(baseUri, sprintId);
  const dbName = buildTestDbName(sprintId);
  assertSprintDbName(dbName);

  const connection = await openSprintConnection(uri);
  try {
    const db = connection.db;
    if (!db) {
      throw new Error(
        `createTestDatabase: mongoose connection for "${dbName}" has no db handle`,
      );
    }
    // `ping` is cheap and confirms the connection is live; MongoDB will
    // lazily create the database on the first actual write performed by
    // the seeder or the child Next.js process.
    await db.admin().command({ ping: 1 });
  } finally {
    await connection.close();
  }

  return { uri, dbName };
}

/**
 * Drop the sprint-owned database. Safety: refuses databases whose name
 * does not start with `apartment_finder_sprint_`.
 */
export async function dropTestDatabase(
  sprintId: string,
  baseUri: string,
): Promise<void> {
  const uri = buildTestMongoUri(baseUri, sprintId);
  const dbName = buildTestDbName(sprintId);
  assertSprintDbName(dbName);

  const connection = await openSprintConnection(uri);
  try {
    const db = connection.db;
    if (!db) {
      throw new Error(
        `dropTestDatabase: mongoose connection for "${dbName}" has no db handle`,
      );
    }
    // Defense in depth: verify the connection actually landed on the
    // sprint-owned database before issuing the drop.
    if (db.databaseName !== dbName) {
      throw new Error(
        `dropTestDatabase: expected to be connected to "${dbName}" ` +
          `but connection reports "${db.databaseName}"`,
      );
    }
    await db.dropDatabase();
  } finally {
    await connection.close();
  }
}
