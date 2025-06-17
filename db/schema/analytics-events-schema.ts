/*
<ai_context>
Database schema for analytics events in WordWise.
</ai_context>
*/

import { pgTable, timestamp, uuid, pgEnum, jsonb } from "drizzle-orm/pg-core"

export const eventTypeEnum = pgEnum("event_type_enum", [
  "suggestion_accepted",
  "suggestion_rejected",
  "document_created",
  "hook_generated"
])

export const analyticsEventsTable = pgTable("analytics_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  eventType: eventTypeEnum("event_type"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull()
})

export type AnalyticsEvent = typeof analyticsEventsTable.$inferSelect
export type NewAnalyticsEvent = typeof analyticsEventsTable.$inferInsert
