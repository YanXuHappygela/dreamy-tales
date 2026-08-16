import { int, mysqlEnum, mysqlTable, primaryKey, text, timestamp, varchar, json } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Community posts — stories shared publicly by users.
 * Stores the full story JSON so it can be downloaded to any device.
 */
export const communityPosts = mysqlTable("community_posts", {
  id: int("id").autoincrement().primaryKey(),
  /** Display name of the poster (anonymous-friendly — no auth required) */
  authorName: varchar("authorName", { length: 80 }).notNull().default("Anonymous"),
  /** Story title */
  title: varchar("title", { length: 255 }).notNull(),
  /** Character used in the story */
  characterType: varchar("characterType", { length: 80 }).notNull(),
  /** Story setting */
  scenario: varchar("scenario", { length: 80 }).notNull(),
  /** Story style */
  style: varchar("style", { length: 80 }).notNull(),
  /** Story language */
  language: varchar("language", { length: 20 }).notNull().default("English"),
  /** Story length in minutes */
  lengthMinutes: int("lengthMinutes").notNull().default(5),
  /** Full story JSON: { title, paragraphs[], config, generatedAt, id } */
  storyJson: json("storyJson").notNull(),
  /** Number of times this story has been downloaded */
  downloadCount: int("downloadCount").notNull().default(0),
  /** Number of likes/hearts this story has received */
  likeCount: int("likeCount").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CommunityPost = typeof communityPosts.$inferSelect;
export type InsertCommunityPost = typeof communityPosts.$inferInsert;

/**
 * Anonymous daily story usage tracking per client IP.
 * The legacy userId column holds a stable negative key derived from the IP;
 * the raw IP is not stored. One row is maintained per client per UTC date.
 */
export const storyUsage = mysqlTable("story_usage", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** UTC date string YYYY-MM-DD */
  date: varchar("date", { length: 10 }).notNull(),
  count: int("count").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StoryUsage = typeof storyUsage.$inferSelect;

/**
 * Server-only anonymous daily counter. The client key is a one-way hash of the
 * request IP, never the raw IP itself. This deliberately has no relation to
 * legacy account tables or legacy usage schemas.
 */
export const anonymousStoryUsage = mysqlTable(
  "anonymous_story_usage",
  {
    clientKey: varchar("clientKey", { length: 64 }).notNull(),
    /** UTC date string YYYY-MM-DD */
    date: varchar("date", { length: 10 }).notNull(),
    count: int("count").notNull().default(0),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.clientKey, table.date] })],
);

export type AnonymousStoryUsage = typeof anonymousStoryUsage.$inferSelect;
