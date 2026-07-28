import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json } from "drizzle-orm/mysql-core";

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
