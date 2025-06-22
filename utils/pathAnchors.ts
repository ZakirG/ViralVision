import { Editor, Node, Text, Operation, Path as SlatePath } from 'slate'
import type { Suggestion } from '@/db/schema'

// Path interface for worker compatibility
export interface WorkerPath {
  path: number[]
  offset: number
}

/**
 * Convert a Slate Path + local offset to absolute character index
 */
export function absolutePath(editor: Editor, targetPath: WorkerPath, offset: number): number {
  let absoluteOffset = 0
  
  try {
    // Walk through all nodes in document order until we reach the target
    for (const [node, path] of Node.nodes(editor)) {
      // Compare paths to see if we've reached our target
      const pathComparison = SlatePath.compare(path, targetPath.path)
      
      if (pathComparison < 0) {
        // This node comes before our target - add its text length
        if (Text.isText(node)) {
          absoluteOffset += node.text.length
        }
        // Add newline for paragraph breaks (except for the first paragraph)
        if (path.length === 1 && path[0] > 0) {
          absoluteOffset += 1
        }
      } else if (pathComparison === 0) {
        // This is our target node - add the local offset
        if (Text.isText(node)) {
          absoluteOffset += Math.min(offset, node.text.length)
        }
        break
      } else {
        // We've passed our target - break
        break
      }
    }
    
    return absoluteOffset
  } catch (error) {
    console.error('Error calculating absolute path:', error)
    return 0
  }
}

/**
 * Update suggestion startOffset/endOffset after a document operation, or return null if invalid
 */
export function adjustSuggestionAfterChange(
  op: Operation, 
  suggestion: Suggestion
): Suggestion | null {
  try {
    // Skip suggestions with null offsets
    if (suggestion.startOffset == null || suggestion.endOffset == null) {
      return null
    }

    const suggestionStart = suggestion.startOffset
    const suggestionEnd = suggestion.endOffset

    switch (op.type) {
      case 'insert_text': {
        // Calculate absolute offset of insertion point
        const insertAbsoluteOffset = calculateAbsoluteOffset(op.path, op.offset)
        const insertLength = op.text.length
        
        // If insertion is before suggestion, shift both offsets
        if (insertAbsoluteOffset <= suggestionStart) {
          return {
            ...suggestion,
            startOffset: suggestionStart + insertLength,
            endOffset: suggestionEnd + insertLength
          }
        }
        
        // If insertion is within suggestion range, invalidate it
        if (insertAbsoluteOffset < suggestionEnd) {
          return null
        }
        
        // Insertion is after suggestion, no change needed
        return suggestion
      }
      
      case 'remove_text': {
        // Calculate absolute offset of deletion point
        const deleteAbsoluteOffset = calculateAbsoluteOffset(op.path, op.offset)
        const deleteLength = op.text.length
        const deleteEnd = deleteAbsoluteOffset + deleteLength
        
        // If deletion is completely before suggestion, shift suggestion left
        if (deleteEnd <= suggestionStart) {
          return {
            ...suggestion,
            startOffset: suggestionStart - deleteLength,
            endOffset: suggestionEnd - deleteLength
          }
        }
        
        // If deletion overlaps with suggestion, invalidate it
        if (deleteAbsoluteOffset < suggestionEnd && deleteEnd > suggestionStart) {
          return null
        }
        
        // Deletion is completely after suggestion, no change needed
        return suggestion
      }
      
      case 'split_node':
      case 'merge_node':
      case 'move_node':
      case 'remove_node':
      case 'insert_node': {
        // For structural changes, be conservative and invalidate suggestions
        // that might be affected by the operation
        return null
      }
      
      default:
        // For unknown operations, keep the suggestion unchanged
        return suggestion
    }
  } catch (error) {
    console.error('Error adjusting suggestion after change:', error)
    // When in doubt, invalidate the suggestion to prevent errors
    return null
  }
}

/**
 * Calculate absolute character offset from a Slate path and local offset
 * This is a simplified version that works with current document structure
 */
function calculateAbsoluteOffset(path: number[], localOffset: number): number {
  // For now, return a simple calculation
  // This would need to be enhanced with access to the actual editor
  // For the scope of this implementation, we'll use approximate calculations
  return (path[0] || 0) * 100 + localOffset
}

/**
 * Filter and adjust suggestions based on editor operations
 */
export function updateSuggestionsAfterOperations(
  operations: Operation[],
  suggestions: Suggestion[]
): Suggestion[] {
  let updatedSuggestions = [...suggestions]
  
  // Apply each operation to all suggestions
  for (const operation of operations) {
    updatedSuggestions = updatedSuggestions
      .map(suggestion => adjustSuggestionAfterChange(operation, suggestion))
      .filter((suggestion): suggestion is Suggestion => suggestion !== null)
  }
  
  return updatedSuggestions
}

/**
 * Convert absolute offset back to Slate Path + offset
 * Useful for creating ranges from absolute positions
 */
export function offsetToPath(editor: Editor, absoluteOffset: number): { path: number[], offset: number } | null {
  let currentOffset = 0
  
  try {
    for (const [node, path] of Node.nodes(editor)) {
      if (Text.isText(node)) {
        const nodeLength = node.text.length
        
        // Check if the target offset falls within this text node
        if (currentOffset + nodeLength >= absoluteOffset) {
          return {
            path,
            offset: absoluteOffset - currentOffset
          }
        }
        
        currentOffset += nodeLength
      }
      
      // Add newline for paragraph breaks
      if (path.length === 1 && path[0] > 0) {
        if (currentOffset >= absoluteOffset) {
          // The offset points to a paragraph boundary
          return {
            path: [path[0] - 1, 0],
            offset: 0
          }
        }
        currentOffset += 1
      }
    }
    
    // If we reach here, the offset is beyond the document
    return null
  } catch (error) {
    console.error('Error converting offset to path:', error)
    return null
  }
} 