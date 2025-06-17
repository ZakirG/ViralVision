/*
<ai_context>
Initializes the database connection and schema for the app.
</ai_context>
*/

import {
  usersTable,
  documentsTable,
  suggestionsTable,
  userProfileSettingsTable,
  analyticsEventsTable,
  apiKeysTable,
  cacheLlmResponsesTable,
  documentVersionsTable
} from "@/db/schema"
import { config } from "dotenv"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

config({ path: ".env.local" })

const schema = {
  users: usersTable,
  documents: documentsTable,
  suggestions: suggestionsTable,
  userProfileSettings: userProfileSettingsTable,
  analyticsEvents: analyticsEventsTable,
  apiKeys: apiKeysTable,
  cacheLlmResponses: cacheLlmResponsesTable,
  documentVersions: documentVersionsTable
}

const client = postgres(process.env.DATABASE_URL!)

export const db = drizzle(client, { schema })
