import { eq, desc, sql, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createHash } from "crypto";
import { createPool, type Pool } from "mysql2/promise";
import { InsertUser, users, communityPosts, InsertCommunityPost, anonymousStoryUsage } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

export function getDatabaseConnectionConfig(): string | Record<string, string> | null {
  const socketPath = process.env.DATABASE_SOCKET_PATH;
  if (socketPath) {
    const { DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME } = process.env;
    if (!DATABASE_USER || !DATABASE_PASSWORD || !DATABASE_NAME) {
      throw new Error("Cloud SQL connection requires DATABASE_USER, DATABASE_PASSWORD, and DATABASE_NAME");
    }
    return {
      host: "localhost",
      socketPath,
      user: DATABASE_USER,
      password: DATABASE_PASSWORD,
      database: DATABASE_NAME,
    };
  }
  return process.env.DATABASE_URL ?? null;
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  const connection = getDatabaseConnectionConfig();
  if (!_db && connection) {
    try {
      if (typeof connection === "string") {
        _db = drizzle(connection);
      } else {
        _pool = createPool(connection);
        _db = drizzle({ client: _pool }) as unknown as ReturnType<typeof drizzle>;
      }
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ── Community Posts ───────────────────────────────────────────────────────────

export async function listCommunityPosts(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(communityPosts).orderBy(desc(communityPosts.createdAt)).limit(limit);
}

export async function createCommunityPost(data: InsertCommunityPost) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(communityPosts).values(data);
  return (result as any).insertId as number;
}

export async function incrementDownloadCount(id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(communityPosts)
    .set({ downloadCount: sql`${communityPosts.downloadCount} + 1` })
    .where(eq(communityPosts.id, id));
}

export async function deleteCommunityPost(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(communityPosts).where(eq(communityPosts.id, id));
}

// ── Story Usage (daily limit) ────────────────────────────────────────────

export const DAILY_STORY_LIMIT = 50;

/** Return the UTC calendar-day key used for anonymous daily-limit accounting. */
export function getUtcDailyKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Convert an IP string to a stable one-way key; the raw IP is never stored. */
export function ipToGuestKey(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

/**
 * Aggregate Cloud Run warning for monitoring daily-limit pressure. It excludes
 * raw IP addresses and client keys so alerting cannot become device tracking.
 */
export function createDailyLimitReachedLog(date: string) {
  return {
    severity: "WARNING",
    event: "daily_limit_reached",
    service: "dreamy-tales-api",
    limit: DAILY_STORY_LIMIT,
    resetBoundary: "UTC_MIDNIGHT",
    date,
  };
}

function describeMySqlError(error: unknown): string {
  const source =
    error && typeof error === "object" && "cause" in error && (error as { cause?: unknown }).cause
      ? (error as { cause: unknown }).cause
      : error;
  if (!source || typeof source !== "object") {
    return source instanceof Error ? source.message : String(source);
  }

  const mysql = source as {
    code?: string;
    errno?: number;
    sqlState?: string;
    sqlMessage?: string;
    message?: string;
  };
  return [
    mysql.code && `code=${mysql.code}`,
    mysql.errno !== undefined && `errno=${mysql.errno}`,
    mysql.sqlState && `sqlState=${mysql.sqlState}`,
    mysql.sqlMessage || mysql.message,
  ]
    .filter(Boolean)
    .join("; ");
}

/**
 * Increment today's anonymous story count for an IP address.
 * The IP is converted to a stable non-reversible database key; the raw IP is
 * never stored in the story_usage table.
 */
export async function incrementStoryUsage(ip: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const today = getUtcDailyKey();
  const clientKey = ipToGuestKey(ip);

  // Upsert: insert or increment
  try {
    await db.execute(sql`
      INSERT INTO anonymous_story_usage (clientKey, date, count)
      VALUES (${clientKey}, ${today}, 1)
      ON DUPLICATE KEY UPDATE count = count + 1
    `);
  } catch (error) {
    const detail = describeMySqlError(error);
    console.error("[Database] Anonymous story counter upsert failed:", error);
    throw new Error(
      `ANONYMOUS_COUNTER_WRITE_FAILED: database=${process.env.DATABASE_NAME ?? "unknown"}; ${detail}`,
    );
  }

  const rows = await db
    .select()
    .from(anonymousStoryUsage)
    .where(and(eq(anonymousStoryUsage.clientKey, clientKey), eq(anonymousStoryUsage.date, today)))
    .limit(1);
  const newCount = rows[0]?.count ?? 1;

  if (newCount > DAILY_STORY_LIMIT) {
    // Roll back the increment
    await db
      .update(anonymousStoryUsage)
      .set({ count: sql`${anonymousStoryUsage.count} - 1` })
      .where(and(eq(anonymousStoryUsage.clientKey, clientKey), eq(anonymousStoryUsage.date, today)));
    console.warn(JSON.stringify(createDailyLimitReachedLog(today)));
    throw new Error(
      `DAILY_LIMIT_REACHED:You've used all ${DAILY_STORY_LIMIT} stories for today. Come back tomorrow for more magical tales!`
    );
  }

  return newCount;
}

export async function incrementLikeCount(id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(communityPosts)
    .set({ likeCount: sql`${communityPosts.likeCount} + 1` })
    .where(eq(communityPosts.id, id));
}
