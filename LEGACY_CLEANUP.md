# Legacy Files Cleanup

This document explains the legacy files that were moved during the Supabase schema sync.

## Files Moved to `.legacy`

### Schema Files
- `db/schema/profiles-schema.ts.legacy` - Old profiles table schema (not in Supabase)
- `db/schema/todos-schema.ts.legacy` - Old todos table schema (not in Supabase)

### Action Files  
- `actions/db/profiles-actions.ts.legacy` - Old profiles actions (not in Supabase)
- `actions/db/todos-actions.ts.legacy` - Old todos actions (not in Supabase)

### Migration Files
- `db/migrations/0000_nostalgic_mauler.sql.legacy` - Old local migration (doesn't match Supabase)
- `db/migrations/0001_good_nico_minoru.sql.legacy` - Old local migration (doesn't match Supabase)

## What Replaced Them

### ✅ Active Schema (matches Supabase)
- `users-schema.ts` - Replaces profiles-schema.ts
- `documents-schema.ts` - Updated to match Supabase structure
- `suggestions-schema.ts` - New table for writing suggestions
- `user-profile-settings-schema.ts` - New table for user settings
- `analytics-events-schema.ts` - New table for analytics
- `api-keys-schema.ts` - New table for API keys
- `cache-llm-responses-schema.ts` - New table for LLM caching
- `document-versions-schema.ts` - New table for document versioning

### ✅ Active Actions
- `users-actions.ts` - Replaces profiles-actions.ts with Clerk-to-UUID conversion
- `documents-actions.ts` - Updated with Clerk-to-UUID conversion
- `suggestions-actions.ts` - New actions for suggestions

## Key Changes

1. **No Migration Needed**: Since you're using Supabase directly and have no existing data
2. **Clerk-to-UUID Mapping**: Implemented deterministic UUID conversion for Clerk user IDs
3. **Schema Sync**: All TypeScript schemas now match your actual Supabase database structure

## Safe to Delete

These `.legacy` files can be safely deleted once you've confirmed everything works correctly. 