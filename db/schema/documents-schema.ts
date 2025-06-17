/*
<ai_context>
Database schema for user documents in WordWise.
</ai_context>
*/

import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  numeric,
  integer,
  boolean
} from "drizzle-orm/pg-core"

// Define enums for the documents table
export const contentTypeEnum = pgEnum("content_type_enum", [
  "education",
  "edutainment",
  "storytime",
  "ad"
])
export const audienceLevelEnum = pgEnum("audience_level_enum", [
  "general",
  "knowledgeable",
  "expert"
])
export const docStatusEnum = pgEnum("doc_status_enum", [
  "draft",
  "processing",
  "ready"
])

export const documentsTable = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  title: text("title"),
  rawText: text("raw_text"),
  contentType: contentTypeEnum("content_type"),
  audienceLevel: audienceLevelEnum("audience_level"),
  status: docStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
})

export type Document = typeof documentsTable.$inferSelect
export type NewDocument = typeof documentsTable.$inferInsert
