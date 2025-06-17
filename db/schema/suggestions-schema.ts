/*
<ai_context>
Database schema for writing suggestions in WordWise.
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

export const suggestionTypeEnum = pgEnum("suggestion_type_enum", [
  "grammar",
  "spelling",
  "style",
  "hook",
  "onscreen_text",
  "rewrite",
  "shorten",
  "delivery_tip"
])

export const suggestionsTable = pgTable("suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull(),
  versionNumber: integer("version_number").notNull(),
  startOffset: integer("start_offset"),
  endOffset: integer("end_offset"),
  suggestionType: suggestionTypeEnum("suggestion_type"),
  suggestedText: text("suggested_text"),
  explanation: text("explanation"),
  confidence: numeric("confidence"),
  accepted: boolean("accepted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull()
})

export type Suggestion = typeof suggestionsTable.$inferSelect
export type NewSuggestion = typeof suggestionsTable.$inferInsert
