/*
<ai_context>
Database actions for users in WordWise.
</ai_context>
*/

"use server"

import { db } from "@/db/db"
import { usersTable, type User, type NewUser } from "@/db/schema"
import { eq } from "drizzle-orm"
import type { ActionState } from "@/types/server-action-types"
import { clerkUserIdToUuid } from "@/lib/clerk-to-uuid"

export async function createUserAction(
  user: NewUser
): Promise<ActionState<User>> {
  try {
    const [newUser] = await db
      .insert(usersTable)
      .values(user)
      .returning()

    return {
      isSuccess: true,
      message: "User created successfully",
      data: newUser
    }
  } catch (error) {
    console.error("Error creating user:", error)
    return {
      isSuccess: false,
      message: "Failed to create user"
    }
  }
}

/**
 * Creates or syncs a user from Clerk to Supabase
 * This should be called when a user signs up or signs in with Clerk
 */
export async function syncClerkUserAction(
  clerkUserId: string,
  email: string
): Promise<ActionState<User>> {
  try {
    const userUuid = clerkUserIdToUuid(clerkUserId)
    
    // Try to find existing user first
    const existingUser = await getUserByIdAction(userUuid)
    
    if (existingUser.isSuccess) {
      // Update last seen
      return await updateUserLastSeenAction(userUuid)
    }
    
    // Create new user if doesn't exist
    const [newUser] = await db
      .insert(usersTable)
      .values({
        id: userUuid,
        email: email
      })
      .returning()

    return {
      isSuccess: true,
      message: "User synced successfully",
      data: newUser
    }
  } catch (error) {
    console.error("Error syncing Clerk user:", error)
    return {
      isSuccess: false,
      message: "Failed to sync user"
    }
  }
}

export async function getUserByIdAction(
  userId: string
): Promise<ActionState<User>> {
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))

    if (!user) {
      return {
        isSuccess: false,
        message: "User not found"
      }
    }

    return {
      isSuccess: true,
      message: "User retrieved successfully",
      data: user
    }
  } catch (error) {
    console.error("Error getting user:", error)
    return {
      isSuccess: false,
      message: "Failed to get user"
    }
  }
}

/**
 * Get user by Clerk user ID (converts to UUID first)
 */
export async function getUserByClerkIdAction(
  clerkUserId: string
): Promise<ActionState<User>> {
  try {
    const userUuid = clerkUserIdToUuid(clerkUserId)
    return await getUserByIdAction(userUuid)
  } catch (error) {
    console.error("Error getting user by Clerk ID:", error)
    return {
      isSuccess: false,
      message: "Failed to get user"
    }
  }
}

export async function getUserByEmailAction(
  email: string
): Promise<ActionState<User>> {
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))

    if (!user) {
      return {
        isSuccess: false,
        message: "User not found"
      }
    }

    return {
      isSuccess: true,
      message: "User retrieved successfully",
      data: user
    }
  } catch (error) {
    console.error("Error getting user by email:", error)
    return {
      isSuccess: false,
      message: "Failed to get user"
    }
  }
}

export async function updateUserLastSeenAction(
  userId: string
): Promise<ActionState<User>> {
  try {
    const [updatedUser] = await db
      .update(usersTable)
      .set({ lastSeenAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning()

    if (!updatedUser) {
      return {
        isSuccess: false,
        message: "User not found"
      }
    }

    return {
      isSuccess: true,
      message: "User last seen updated successfully",
      data: updatedUser
    }
  } catch (error) {
    console.error("Error updating user last seen:", error)
    return {
      isSuccess: false,
      message: "Failed to update user last seen"
    }
  }
}

/**
 * Update user last seen by Clerk user ID (converts to UUID first)
 */
export async function updateUserLastSeenByClerkIdAction(
  clerkUserId: string
): Promise<ActionState<User>> {
  try {
    const userUuid = clerkUserIdToUuid(clerkUserId)
    return await updateUserLastSeenAction(userUuid)
  } catch (error) {
    console.error("Error updating user last seen by Clerk ID:", error)
    return {
      isSuccess: false,
      message: "Failed to update user last seen"
    }
  }
} 