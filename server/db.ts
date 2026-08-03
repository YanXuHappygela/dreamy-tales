import { eq, desc, sql, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, communityPosts, InsertCommunityPost, storyUsage } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
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

const FREE_DAILY_LIMIT = 3;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function getStoryUsageToday(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select()
    .from(storyUsage)
    .where(and(eq(storyUsage.userId, userId), eq(storyUsage.date, todayUtc())))
    .limit(1);
  return rows[0]?.count ?? 0;
}

/**
 * Increment today's story count for a user.
 * Returns the new count after increment.
 * Throws if the daily limit is exceeded.
 */
export async function incrementStoryUsage(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const today = todayUtc();

  // Upsert: insert or increment
  await db
    .insert(storyUsage)
    .values({ userId, date: today, count: 1 })
    .onDuplicateKeyUpdate({ set: { count: sql`${storyUsage.count} + 1` } });

  const rows = await db
    .select()
    .from(storyUsage)
    .where(and(eq(storyUsage.userId, userId), eq(storyUsage.date, today)))
    .limit(1);
  const newCount = rows[0]?.count ?? 1;

  if (newCount > FREE_DAILY_LIMIT) {
    // Roll back the increment
    await db
      .update(storyUsage)
      .set({ count: sql`${storyUsage.count} - 1` })
      .where(and(eq(storyUsage.userId, userId), eq(storyUsage.date, today)));
    throw new Error(`Daily limit reached. Free users can generate ${FREE_DAILY_LIMIT} stories per day.`);
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
