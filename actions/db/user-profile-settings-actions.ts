/*
<ai_context>
Database actions for user profile settings in WordWise.
</ai_context>
*/

"use server"

import { db } from "@/db/db"
import { userProfileSettingsTable, type UserProfileSettings, type NewUserProfileSettings } from "@/db/schema"
import { eq } from "drizzle-orm"
import type { ActionState } from "@/types/server-action-types"
import { clerkUserIdToUuid } from "@/lib/clerk-to-uuid"
import { auth } from "@clerk/nextjs/server"

export async function createUserProfileSettingsAction(
  settings: Omit<NewUserProfileSettings, "userId">
): Promise<ActionState<UserProfileSettings>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return {
        isSuccess: false,
        message: "User not authenticated"
      }
    }

    const userUuid = clerkUserIdToUuid(userId)

    const [newSettings] = await db
      .insert(userProfileSettingsTable)
      .values({
        ...settings,
        userId: userUuid
      })
      .returning()

    return {
      isSuccess: true,
      message: "User profile settings created successfully",
      data: newSettings
    }
  } catch (error) {
    console.error("Error creating user profile settings:", error)
    return {
      isSuccess: false,
      message: "Failed to create user profile settings"
    }
  }
}

export async function getUserProfileSettingsAction(): Promise<ActionState<UserProfileSettings>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return {
        isSuccess: false,
        message: "User not authenticated"
      }
    }

    const userUuid = clerkUserIdToUuid(userId)

    const [settings] = await db
      .select()
      .from(userProfileSettingsTable)
      .where(eq(userProfileSettingsTable.userId, userUuid))

    if (!settings) {
      return {
        isSuccess: false,
        message: "User profile settings not found"
      }
    }

    return {
      isSuccess: true,
      message: "User profile settings retrieved successfully",
      data: settings
    }
  } catch (error) {
    console.error("Error getting user profile settings:", error)
    return {
      isSuccess: false,
      message: "Failed to get user profile settings"
    }
  }
}

export async function updateUserProfileSettingsAction(
  updates: Partial<Omit<NewUserProfileSettings, "userId" | "id">>
): Promise<ActionState<UserProfileSettings>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return {
        isSuccess: false,
        message: "User not authenticated"
      }
    }

    const userUuid = clerkUserIdToUuid(userId)

    const updateData = {
      ...updates,
      updatedAt: new Date()
    }

    const [updatedSettings] = await db
      .update(userProfileSettingsTable)
      .set(updateData)
      .where(eq(userProfileSettingsTable.userId, userUuid))
      .returning()

    if (!updatedSettings) {
      return {
        isSuccess: false,
        message: "User profile settings not found"
      }
    }

    return {
      isSuccess: true,
      message: "User profile settings updated successfully",
      data: updatedSettings
    }
  } catch (error) {
    console.error("Error updating user profile settings:", error)
    return {
      isSuccess: false,
      message: "Failed to update user profile settings"
    }
  }
}

export async function syncUserProfileSettingsAction(
  clerkUserId: string
): Promise<ActionState<UserProfileSettings>> {
  try {
    const userUuid = clerkUserIdToUuid(clerkUserId)
    
    // Try to find existing settings first
    const existingSettings = await db
      .select()
      .from(userProfileSettingsTable)
      .where(eq(userProfileSettingsTable.userId, userUuid))

    if (existingSettings.length > 0) {
      return {
        isSuccess: true,
        message: "User profile settings already exist",
        data: existingSettings[0]
      }
    }
    
    // Create default settings if they don't exist
    const [newSettings] = await db
      .insert(userProfileSettingsTable)
      .values({
        userId: userUuid,
        brandVoiceRules: null,
        writingApproachRules: null,
        defaultContentType: "education",
        defaultAudience: "general"
      })
      .returning()

    return {
      isSuccess: true,
      message: "User profile settings created with defaults",
      data: newSettings
    }
  } catch (error) {
    console.error("Error syncing user profile settings:", error)
    return {
      isSuccess: false,
      message: "Failed to sync user profile settings"
    }
  }
} 