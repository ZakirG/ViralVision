/*
<ai_context>
Database schema for user profile settings in WordWise.
</ai_context>
*/

import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { contentTypeEnum, audienceLevelEnum } from "./documents-schema"

export const userProfileSettingsTable = pgTable("user_profile_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  brandVoiceRules: text("brand_voice_rules"),
  writingApproachRules: text("writing_approach_rules"),
  defaultContentType: contentTypeEnum("default_content_type"),
  defaultAudience: audienceLevelEnum("default_audience"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
})

export type UserProfileSettings = typeof userProfileSettingsTable.$inferSelect
export type NewUserProfileSettings =
  typeof userProfileSettingsTable.$inferInsert
