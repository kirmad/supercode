/**
 * XML Tag Parser for Operation Subscription
 * Handles real-time XML parsing from streaming agent responses
 */

import { createLogger } from './utils.js'
import type { ExtractedTagData } from '../types/index.js'

export interface XMLParsingResult {
  /** Extracted tag data */
  tagData: ExtractedTagData
  /** Whether all requested tags were found complete */
  isComplete: boolean
  /** Any partial tags detected */
  partialTags: string[]
}

/**
 * XML tag parser for extracting structured data from agent responses
 * Handles both complete and partial XML content for real-time processing
 */
export class XMLTagParser {
  private logger = createLogger('XMLTagParser')

  /**
   * Extract XML tags from content
   * @param content - Raw text content to parse
   * @param tags - Array of tag names to extract
   * @returns Extracted tag data with completion status
   */
  extractTags(content: string, tags: string[]): XMLParsingResult {
    const tagData: ExtractedTagData = {}
    const partialTags: string[] = []

    for (const tag of tags) {
      const result = this.parseXMLTag(content, tag)

      if (result.values.length > 0) {
        tagData[tag] = result.values
      }

      if (result.hasPartial) {
        partialTags.push(tag)
      }
    }

    const isComplete = partialTags.length === 0 && Object.keys(tagData).length > 0

    this.logger.debug('Extracted XML tags', {
      requestedTags: tags,
      extractedTags: Object.keys(tagData),
      partialTags,
      isComplete,
      totalValues: Object.values(tagData).reduce((sum, values) => sum + values.length, 0)
    })

    return {
      tagData,
      isComplete,
      partialTags
    }
  }

  /**
   * Parse a specific XML tag from content
   * @param content - Text content to parse
   * @param tagName - Tag name to extract
   * @returns Parsed values and partial detection
   */
  private parseXMLTag(content: string, tagName: string): {
    values: string[]
    hasPartial: boolean
  } {
    const values: string[] = []
    let hasPartial = false

    // Handle both self-closing and paired tags
    // Pattern explanation:
    // - <tagName(?:\s[^>]*)?   : Opening tag with optional attributes
    // - (?:/>|>([\\s\\S]*?)<\\/tagName>)  : Either self-closing or content + closing tag
    const pairedTagRegex = new RegExp(
      `<${tagName}(?:\\s[^>]*)?>(.*?)<\\/${tagName}>`,
      'gs'
    )

    const selfClosingRegex = new RegExp(
      `<${tagName}(?:\\s[^>]*)?\\s*\\/>`,
      'gs'
    )

    // Extract paired tags
    let match: RegExpExecArray | null
    while ((match = pairedTagRegex.exec(content)) !== null) {
      // For hunk and comment tags, return full tag to preserve attributes
      if (tagName === 'hunk' || tagName === 'comment') {
        const fullTag = match[0]?.trim()
        if (fullTag && !this.isInstructionExample(fullTag)) {
          values.push(fullTag)
        }
      } else {
        // For other tags, return inner content as before
        const tagContent = match[1]?.trim()
        if (tagContent && tagContent.length > 0) {
          // Filter out instruction examples and template content
          if (!this.isInstructionExample(tagContent)) {
            values.push(tagContent)
          }
        }
      }
    }

    // Extract self-closing tags (check for content in attributes)
    while ((match = selfClosingRegex.exec(content)) !== null) {
      const fullTag = match[0]
      const attributeContent = this.extractAttributeContent(fullTag)
      if (attributeContent && !this.isInstructionExample(attributeContent)) {
        values.push(attributeContent)
      }
    }

    // Check for partial tags (opening tag without closing)
    hasPartial = this.hasPartialTag(content, tagName)

    return { values, hasPartial }
  }

  /**
   * Extract content from tag attributes (for self-closing tags)
   * @param tagMatch - Full tag match string
   * @returns Extracted content or empty string
   */
  private extractAttributeContent(tagMatch: string): string {
    // Try common attribute names for content
    const contentPatterns = [
      /content=["']([^"']+)["']/,
      /value=["']([^"']+)["']/,
      /text=["']([^"']+)["']/,
      /message=["']([^"']+)["']/
    ]

    for (const pattern of contentPatterns) {
      const match = tagMatch.match(pattern)
      if (match) {
        return match[1]
      }
    }

    return ''
  }

  /**
   * Check if content contains partial/incomplete tags
   * @param content - Text content to check
   * @param tagName - Tag name to check for
   * @returns true if partial tags detected
   */
  private hasPartialTag(content: string, tagName: string): boolean {
    // Look for opening tags without corresponding closing tags
    const openingTagRegex = new RegExp(`<${tagName}(?:\\s[^>]*)?>`, 'g')
    const closingTagRegex = new RegExp(`<\\/${tagName}>`, 'g')

    const openingMatches = content.match(openingTagRegex) || []
    const closingMatches = content.match(closingTagRegex) || []

    // Self-closing tags don't count as partial
    const selfClosingMatches = content.match(new RegExp(`<${tagName}(?:\\s[^>]*)?\\s*\\/>`, 'g')) || []

    const openingCount = openingMatches.length - selfClosingMatches.length
    const closingCount = closingMatches.length

    // If we have more opening tags than closing tags, there are partial tags
    const hasPartial = openingCount > closingCount

    if (hasPartial) {
      this.logger.debug('Partial tag detected', {
        tagName,
        openingCount,
        closingCount,
        selfClosingCount: selfClosingMatches.length
      })
    }

    return hasPartial
  }

  /**
   * Check if content appears to be an instruction example rather than real data
   * @param content - Content to check
   * @returns true if appears to be instruction/example content
   */
  private isInstructionExample(content: string): boolean {
    const instructionPatterns = [
      /^(example|sample|template)/i,
      /\[.*?\]/,  // Placeholder brackets
      /\{.*?\}/,  // Template variables
      /TODO|FIXME|NOTE/i,
      /^(this is|here's an example|for example)/i,
      /^(use this pattern|follow this format)/i
    ]

    return instructionPatterns.some(pattern => pattern.test(content.trim()))
  }

  /**
   * Aggregate tag data from multiple sources with deduplication
   * @param existing - Existing tag data
   * @param newData - New tag data to merge
   * @returns Merged and deduplicated tag data
   */
  aggregateTagData(existing: ExtractedTagData, newData: ExtractedTagData): ExtractedTagData {
    const result: ExtractedTagData = { ...existing }

    for (const [tag, values] of Object.entries(newData)) {
      if (result[tag]) {
        // Merge arrays and deduplicate
        const combined = [...result[tag], ...values]
        result[tag] = Array.from(new Set(combined))
      } else {
        result[tag] = [...values]
      }
    }

    this.logger.debug('Aggregated tag data', {
      existingTags: Object.keys(existing),
      newTags: Object.keys(newData),
      resultTags: Object.keys(result),
      totalValues: Object.values(result).reduce((sum, values) => sum + values.length, 0)
    })

    return result
  }

  /**
   * Check if new data contains changes compared to existing data
   * @param oldData - Previous tag data
   * @param newData - New tag data
   * @returns true if there are new or changed values
   */
  hasNewData(oldData: ExtractedTagData, newData: ExtractedTagData): boolean {
    for (const [tag, values] of Object.entries(newData)) {
      const oldValues = oldData[tag] || []

      // Check if tag didn't exist before
      if (oldValues.length === 0 && values.length > 0) {
        return true
      }

      // Check if any new values were added
      if (values.length !== oldValues.length) {
        return true
      }

      // Check if any values are different (order doesn't matter)
      const oldSet = new Set(oldValues)
      const hasNewValue = values.some(value => !oldSet.has(value))

      if (hasNewValue) {
        return true
      }
    }

    return false
  }

  /**
   * Validate and sanitize tag names
   * @param tags - Array of tag names to validate
   * @returns Validated tag names
   */
  validateTagNames(tags: string[]): string[] {
    const validatedTags: string[] = []

    for (const tag of tags) {
      // Basic XML tag name validation
      if (typeof tag === 'string' && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(tag)) {
        validatedTags.push(tag)
      } else {
        this.logger.warn('Invalid tag name ignored', { invalidTag: tag })
      }
    }

    return validatedTags
  }

  /**
   * Process streaming content with buffer management
   * @param newContent - New content chunk
   * @param existingBuffer - Existing content buffer
   * @param tags - Tags to extract
   * @returns Processing result with updated buffer
   */
  processStreamingContent(
    newContent: string,
    existingBuffer: string,
    tags: string[]
  ): {
    result: XMLParsingResult
    updatedBuffer: string
    hasCompleteData: boolean
  } {
    const fullContent = existingBuffer + newContent
    const result = this.extractTags(fullContent, tags)

    // Keep content in buffer until we have complete tags
    const shouldKeepBuffer = result.partialTags.length > 0 || Object.keys(result.tagData).length === 0

    return {
      result,
      updatedBuffer: shouldKeepBuffer ? fullContent : '',
      hasCompleteData: result.isComplete && Object.keys(result.tagData).length > 0
    }
  }
}