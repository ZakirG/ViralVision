/*
<ai_context>
Database schema for caching LLM responses in WordWise.
</ai_context>
*/

import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core"

export const cacheLlmResponsesTable = pgTable("cache_llm_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  promptHash: text("prompt_hash").notNull(),
  response: jsonb("response"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull()
})

export type CacheLlmResponse = typeof cacheLlmResponsesTable.$inferSelect
export type NewCacheLlmResponse = typeof cacheLlmResponsesTable.$inferInsert
