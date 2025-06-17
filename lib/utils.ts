/*
<ai_context>
Contains the utility functions for the app.
</ai_context>
*/

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converts HTML content to clean preview text by removing HTML tags
 * and converting formatting elements to appropriate text equivalents
 */
export function htmlToPreviewText(htmlContent: string): string {
  if (!htmlContent) return ""
  
  // Create a temporary div to parse HTML safely
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = htmlContent
  
  // Convert <br> tags to newlines before stripping HTML
  const brTags = tempDiv.querySelectorAll('br')
  brTags.forEach(br => {
    br.replaceWith('\n')
  })
  
  // Handle block-level elements (div, p, etc.) by adding newlines
  const blockElements = tempDiv.querySelectorAll('div, p, h1, h2, h3, h4, h5, h6')
  blockElements.forEach(element => {
    // Add newline before the element if it's not the first child
    if (element.previousSibling) {
      element.insertAdjacentText('beforebegin', '\n')
    }
  })
  
  // Remove suggestion highlighting spans and other formatting
  const suggestionSpans = tempDiv.querySelectorAll('.suggestion-highlight, .suggestion-selected')
  suggestionSpans.forEach(span => {
    const parent = span.parentNode
    if (parent) {
      const textNode = document.createTextNode(span.textContent || '')
      parent.replaceChild(textNode, span)
    }
  })
  
  // Get clean text content
  const cleanText = tempDiv.textContent || ''
  
  // Clean up extra whitespace and normalize line breaks
  return cleanText
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Replace multiple line breaks with max 2
    .replace(/^\s+|\s+$/g, '') // Trim start and end
    .replace(/[ \t]+/g, ' ') // Normalize spaces
}

/**
 * Server-side version of htmlToPreviewText that doesn't use DOM APIs
 * Useful for server components and initial rendering
 */
export function htmlToPreviewTextServer(htmlContent: string): string {
  if (!htmlContent) return ""
  
  return htmlContent
    // Convert <br> and <br/> tags to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    // Convert block elements to newlines
    .replace(/<\/(div|p|h[1-6]|li)>/gi, '\n')
    // Remove all HTML tags
    .replace(/<[^>]*>/g, '')
    // Decode HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Clean up extra whitespace and normalize line breaks
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Replace multiple line breaks with max 2
    .replace(/^\s+|\s+$/g, '') // Trim start and end
    .replace(/[ \t]+/g, ' ') // Normalize spaces
}
