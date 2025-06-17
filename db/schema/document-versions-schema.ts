/*
<ai_context>
Database schema for document versions in WordWise.
</ai_context>
*/

import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core"

export const documentVersionsTable = pgTable("document_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull(),
  versionNumber: integer("version_number").notNull(),
  textSnapshot: text("text_snapshot"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull()
})

export type DocumentVersion = typeof documentVersionsTable.$inferSelect
export type NewDocumentVersion = typeof documentVersionsTable.$inferInsert
