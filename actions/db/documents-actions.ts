/*
<ai_context>
Database actions for documents in WordWise.
</ai_context>
*/

"use server"

import { db } from "@/db/db"
import { documentsTable, type Document, type NewDocument } from "@/db/schema"
import { eq, desc, and } from "drizzle-orm"
import { auth } from "@clerk/nextjs/server"
import type { ActionState } from "@/types/server-action-types"
import { clerkUserIdToUuid } from "@/lib/clerk-to-uuid"

export async function createDocumentAction(
  document: Omit<NewDocument, "userId">
): Promise<ActionState<Document>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return {
        isSuccess: false,
        message: "User not authenticated"
      }
    }

    const userUuid = clerkUserIdToUuid(userId)

    const [newDocument] = await db
      .insert(documentsTable)
      .values({
        ...document,
        userId: userUuid
      })
      .returning()

    return {
      isSuccess: true,
      message: "Document created successfully",
      data: newDocument
    }
  } catch (error) {
    console.error("Error creating document:", error)
    return {
      isSuccess: false,
      message: "Failed to create document"
    }
  }
}

export async function getDocumentsByUserIdAction(): Promise<ActionState<Document[]>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return {
        isSuccess: false,
        message: "User not authenticated"
      }
    }

    const userUuid = clerkUserIdToUuid(userId)

    const documents = await db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.userId, userUuid))
      .orderBy(desc(documentsTable.updatedAt))

    return {
      isSuccess: true,
      message: "Documents retrieved successfully",
      data: documents
    }
  } catch (error) {
    console.error("Error getting documents:", error)
    return {
      isSuccess: false,
      message: "Failed to get documents"
    }
  }
}

export async function getDocumentByIdAction(
  documentId: string
): Promise<ActionState<Document>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return {
        isSuccess: false,
        message: "User not authenticated"
      }
    }

    const userUuid = clerkUserIdToUuid(userId)

    const [document] = await db
      .select()
      .from(documentsTable)
      .where(and(
        eq(documentsTable.id, documentId),
        eq(documentsTable.userId, userUuid)
      ))

    if (!document) {
      return {
        isSuccess: false,
        message: "Document not found"
      }
    }

    return {
      isSuccess: true,
      message: "Document retrieved successfully",
      data: document
    }
  } catch (error) {
    console.error("Error getting document:", error)
    return {
      isSuccess: false,
      message: "Failed to get document"
    }
  }
}

export async function updateDocumentAction(
  documentId: string,
  updates: Partial<Omit<NewDocument, "userId" | "id">>
): Promise<ActionState<Document>> {
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

    const [updatedDocument] = await db
      .update(documentsTable)
      .set(updateData)
      .where(and(
        eq(documentsTable.id, documentId),
        eq(documentsTable.userId, userUuid)
      ))
      .returning()

    if (!updatedDocument) {
      return {
        isSuccess: false,
        message: "Document not found"
      }
    }

    return {
      isSuccess: true,
      message: "Document updated successfully",
      data: updatedDocument
    }
  } catch (error) {
    console.error("Error updating document:", error)
    return {
      isSuccess: false,
      message: "Failed to update document"
    }
  }
}

export async function deleteDocumentAction(
  documentId: string
): Promise<ActionState<void>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return {
        isSuccess: false,
        message: "User not authenticated"
      }
    }

    const userUuid = clerkUserIdToUuid(userId)

    const [deletedDocument] = await db
      .delete(documentsTable)
      .where(and(
        eq(documentsTable.id, documentId),
        eq(documentsTable.userId, userUuid)
      ))
      .returning()

    if (!deletedDocument) {
      return {
        isSuccess: false,
        message: "Document not found"
      }
    }

    return {
      isSuccess: true,
      message: "Document deleted successfully",
      data: undefined
    }
  } catch (error) {
    console.error("Error deleting document:", error)
    return {
      isSuccess: false,
      message: "Failed to delete document"
    }
  }
} 