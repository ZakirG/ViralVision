/*
<ai_context>
Database actions for documents in WordWise.
</ai_context>
*/

"use server"

import { db } from "@/db/db"
import { documentsTable, documentVersionsTable, type Document, type NewDocument } from "@/db/schema"
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
      console.error("❌ Document creation failed: User not authenticated")
      return {
        isSuccess: false,
        message: "User not authenticated"
      }
    }

    const userUuid = clerkUserIdToUuid(userId)
    console.log("📝 Creating document for user:", userUuid, "with data:", document)

    // Validate input data
    if (!document.title || !document.title.trim()) {
      console.error("❌ Document creation failed: Title is required")
      return {
        isSuccess: false,
        message: "Document title is required"
      }
    }

    // Create document and initial version in a transaction with timeout protection
    const result = await db.transaction(async (tx) => {
      console.log("🔄 Starting database transaction for document creation")
      
      // Create the document
      const [newDocument] = await tx
        .insert(documentsTable)
        .values({
          ...document,
          userId: userUuid,
          rawText: document.rawText || "", // Ensure rawText is never null
          status: "draft" // Explicitly set status
        })
        .returning()

      if (!newDocument) {
        throw new Error("Failed to create document - no data returned")
      }

      console.log("✅ Document created with ID:", newDocument.id)

      // Create the initial document version (version 1)
      await tx
        .insert(documentVersionsTable)
        .values({
          documentId: newDocument.id,
          versionNumber: 1,
          textSnapshot: document.rawText || ""
        })

      console.log("✅ Initial document version created for document:", newDocument.id)

      return newDocument
    })

    console.log("✅ Document creation transaction completed successfully")
    return {
      isSuccess: true,
      message: "Document created successfully",
      data: result
    }
  } catch (error) {
    console.error("❌ Error creating document:", error)
    
    // Provide more specific error messages based on the error type
    let errorMessage = "Failed to create document"
    
    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        errorMessage = "Request timed out. Please try again."
      } else if (error.message.includes("connection")) {
        errorMessage = "Database connection issue. Please try again."
      } else if (error.message.includes("constraint")) {
        errorMessage = "Invalid data provided. Please check your input."
      }
    }

    return {
      isSuccess: false,
      message: errorMessage
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

    // Update document and document version in a transaction
    const result = await db.transaction(async (tx) => {
      // Update the document
      const [updatedDocument] = await tx
        .update(documentsTable)
        .set(updateData)
        .where(and(
          eq(documentsTable.id, documentId),
          eq(documentsTable.userId, userUuid)
        ))
        .returning()

      if (!updatedDocument) {
        throw new Error("Document not found")
      }

      // Update the document version snapshot if rawText was updated
      if (updates.rawText !== undefined) {
        await tx
          .update(documentVersionsTable)
          .set({
            textSnapshot: updates.rawText
          })
          .where(and(
            eq(documentVersionsTable.documentId, documentId),
            eq(documentVersionsTable.versionNumber, 1)
          ))
      }

      return updatedDocument
    })

    return {
      isSuccess: true,
      message: "Document updated successfully",
      data: result
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