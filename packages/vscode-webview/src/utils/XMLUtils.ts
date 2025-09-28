/**
 * XML Parsing Utilities for Prompt Enhancement
 * Handles partial XML, streaming content, and deduplication
 */

import type { ResearchItem, ClarificationQuestion, EnhancedPromptMetadata } from '../services/PromptEnhancementService';

/**
 * XML Parser configuration and state
 */
export interface XMLParserConfig {
  globalProcessedResearch?: Set<string>;
  processedContent?: Set<string>;
}

/**
 * Result of parsing enhanced prompt XML
 */
export interface ParsedEnhancedPrompt {
  prompt: string;
  metadata: EnhancedPromptMetadata;
}

/**
 * XML Parser class with streaming and deduplication support
 */
export class XMLParser {
  private globalProcessedResearch: Set<string>;

  constructor(config?: XMLParserConfig) {
    this.globalProcessedResearch = config?.globalProcessedResearch || new Set();
  }

  /**
   * Clear global deduplication tracking
   */
  public clearDuplicationTracking() {
    this.globalProcessedResearch.clear();
  }

  /**
   * Get the global processed research set for external management
   */
  public getGlobalProcessedResearch(): Set<string> {
    return this.globalProcessedResearch;
  }

  /**
   * Parse XML content from the response
   * Handles partial XML and nested tags
   */
  public parseXMLContent(content: string, tag: string): string[] {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g');
    const matches: string[] = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      matches.push(match[1].trim());
    }

    return matches;
  }

  /**
   * Parse research updates from XML
   * Extracts research-update tags with type and priority attributes
   */
  public parseResearchUpdates(content: string): ResearchItem[] {
    const items: ResearchItem[] = [];
    const regex = /<research-update\s+type="([^"]+)"\s+priority="([^"]+)">([^<]+)<\/research-update>/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      items.push({
        id: `research-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        type: match[1] as ResearchItem['type'],
        priority: match[2] as ResearchItem['priority'],
        content: match[3].trim(),
        timestamp: Date.now(),
        status: 'completed'
      });
    }

    return items;
  }

  /**
   * Parse clarification questions from XML
   * Handles nested question, text, and options tags
   */
  public parseClarificationQuestions(content: string): ClarificationQuestion[] {
    const questions: ClarificationQuestion[] = [];
    const clarificationBlocks = this.parseXMLContent(content, 'clarification-needed');

    for (const block of clarificationBlocks) {
      // Updated regex to handle multiline question blocks
      const questionRegex = /<question\s+id="([^"]+)">\s*<text>([^<]+)<\/text>\s*<options>([\s\S]*?)<\/options>\s*<\/question>/g;
      let match;

      while ((match = questionRegex.exec(block)) !== null) {
        const optionRegex = /<option\s+value="([^"]+)">([^<]+)<\/option>/g;
        const options: Array<{ value: string; label: string }> = [];
        let optionMatch;

        while ((optionMatch = optionRegex.exec(match[3])) !== null) {
          options.push({
            value: optionMatch[1],
            label: optionMatch[2].trim()
          });
        }

        questions.push({
          id: match[1],
          text: match[2].trim(),
          options
        });
      }
    }

    return questions;
  }

  /**
   * Process streaming clarification questions from text content
   * Handles partial XML and real-time updates
   */
  public processStreamingClarifications(textContent: string, existingQuestions: ClarificationQuestion[] = []): {
    questions: ClarificationQuestion[];
    newQuestions: ClarificationQuestion[];
  } {
    const allQuestions = [...existingQuestions];
    const newQuestions: ClarificationQuestion[] = [];

    // Extract clarification-needed blocks
    const clarificationRegex = /<clarification-needed>([\s\S]*?)<\/clarification-needed>/g;
    let match;

    while ((match = clarificationRegex.exec(textContent)) !== null) {
      const block = match[1];

      // Parse individual questions
      const questionRegex = /<question\s+id="([^"]+)">\s*<text>([^<]+)<\/text>\s*<options>([\s\S]*?)<\/options>\s*<\/question>/g;
      let qMatch;

      while ((qMatch = questionRegex.exec(block)) !== null) {
        const questionId = qMatch[1];

        // Check if we already have this question
        if (!allQuestions.some(q => q.id === questionId)) {
          const optionRegex = /<option\s+value="([^"]+)">([^<]+)<\/option>/g;
          const options: Array<{ value: string; label: string }> = [];
          let optionMatch;

          while ((optionMatch = optionRegex.exec(qMatch[3])) !== null) {
            options.push({
              value: optionMatch[1],
              label: optionMatch[2].trim()
            });
          }

          const question: ClarificationQuestion = {
            id: questionId,
            text: qMatch[2].trim(),
            options
          };

          allQuestions.push(question);
          newQuestions.push(question);
        }
      }
    }

    return { questions: allQuestions, newQuestions };
  }

  /**
   * Parse enhanced prompt and metadata from XML
   * Handles nested content and metadata tags
   */
  public parseEnhancedPrompt(content: string): ParsedEnhancedPrompt | null {
    const enhancedBlocks = this.parseXMLContent(content, 'enhanced-prompt');

    if (enhancedBlocks.length === 0) {
      console.warn('[XMLParser] No <enhanced-prompt> XML tags found in response');
      console.warn('[XMLParser] Response preview:', content.substring(0, 500));
      return null;
    }

    const block = enhancedBlocks[0];

    // Parse metadata
    const metadataMatch = /<metadata>([\s\S]*?)<\/metadata>/s.exec(block);
    let metadata: EnhancedPromptMetadata = {
      complexity: 'moderate',
      domains: [],
      technologies: [],
      patterns: []
    };

    if (metadataMatch) {
      const metadataContent = metadataMatch[1];

      // Parse complexity
      const complexityMatch = /<complexity>([^<]+)<\/complexity>/.exec(metadataContent);
      if (complexityMatch) {
        metadata.complexity = complexityMatch[1] as EnhancedPromptMetadata['complexity'];
      }

      // Parse domains
      const domainsMatch = /<domains>([^<]+)<\/domains>/.exec(metadataContent);
      if (domainsMatch) {
        metadata.domains = domainsMatch[1].split(',').map(d => d.trim());
      }

      // Parse technologies
      const techMatch = /<technologies>([^<]+)<\/technologies>/.exec(metadataContent);
      if (techMatch) {
        metadata.technologies = techMatch[1].split(',').map(t => t.trim());
      }

      // Parse patterns
      const patternsMatch = /<patterns>([^<]+)<\/patterns>/.exec(metadataContent);
      if (patternsMatch) {
        metadata.patterns = patternsMatch[1].split(',').map(p => p.trim());
      }
    }

    // Parse content - try nested <content> tag first, then fallback to direct content
    const contentMatch = /<content>([\s\S]*?)<\/content>/.exec(block);
    let prompt = '';

    if (contentMatch) {
      // Content is nested in <content> tag
      prompt = contentMatch[1].trim();
    } else {
      // Content might be directly in the enhanced-prompt block
      // Remove metadata section and get the remaining content
      const cleanedBlock = block.replace(/<metadata>[\s\S]*?<\/metadata>/g, '').trim();
      prompt = cleanedBlock;
    }

    console.log('[XMLParser] Parsed enhanced prompt length:', prompt.length);
    console.log('[XMLParser] First 200 chars of prompt:', prompt.substring(0, 200));

    return { prompt, metadata };
  }

  /**
   * Process streaming research updates from text content with deduplication
   * Handles partial XML and filters out instruction examples
   */
  public processStreamingResearch(
    textContent: string,
    processedContent?: Set<string>
  ): {
    items: ResearchItem[];
    updatedProcessedContent: Set<string>;
  } {
    const items: ResearchItem[] = [];
    const localProcessed = processedContent || new Set<string>();

    // Extract all research-update tags
    const researchRegex = /<research-update[^>]*>([\s\S]*?)<\/research-update>/g;
    let match;

    while ((match = researchRegex.exec(textContent)) !== null) {
      const fullMatch = match[0];
      const content = match[1].trim();

      // Filter out instruction examples from the prompt
      if (this.isInstructionExample(content)) {
        console.log('[XMLParser] Skipping instruction example:', content.substring(0, 50) + '...');
        continue;
      }

      // Create a unique key for this research item based on its content
      const contentKey = content;

      // Check against global processed set
      if (this.globalProcessedResearch.has(contentKey)) {
        console.log('[XMLParser] Skipping duplicate research:', content.substring(0, 50) + '...');
        continue; // Skip already processed
      }

      // Parse attributes
      const typeMatch = /type="([^"]+)"/.exec(fullMatch);
      const priorityMatch = /priority="([^"]+)"/.exec(fullMatch);

      const researchItem: ResearchItem = {
        id: `research-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        type: (typeMatch?.[1] || 'analysis') as ResearchItem['type'],
        priority: (priorityMatch?.[1] || 'medium') as ResearchItem['priority'],
        content: content,
        timestamp: Date.now(),
        status: 'completed'
      };

      // Mark as processed in global set to prevent duplicates
      this.globalProcessedResearch.add(contentKey);

      // Also add to local set if provided (for compatibility)
      localProcessed.add(contentKey);

      // Add to research items
      items.push(researchItem);

      console.log('[XMLParser] Processed research:', researchItem.type, '-', content.substring(0, 80) + '...');
    }

    return { items, updatedProcessedContent: localProcessed };
  }

  /**
   * Check if content is an instruction example rather than real research
   */
  private isInstructionExample(content: string): boolean {
    return content.includes('analysis|pattern|requirement|best-practice') ||
      content.includes('high|medium|low') ||
      content.includes('Send each finding immediately') ||
      content.includes('don\'t wait until the end') ||
      content.includes('IMMEDIATELY as you discover') ||
      content.includes('tags IMMEDIATELY') ||
      content.includes('discovering insights as I analyze') ||
      content.includes('Stream research findings in real-time') ||
      content.length < 20; // Very short content is likely not real research
  }
}

/**
 * Singleton instance for convenient usage
 */
export const xmlParser = new XMLParser();

/**
 * Export utility functions for backward compatibility
 */
export const parseXMLContent = (content: string, tag: string) => xmlParser.parseXMLContent(content, tag);
export const parseResearchUpdates = (content: string) => xmlParser.parseResearchUpdates(content);
export const parseClarificationQuestions = (content: string) => xmlParser.parseClarificationQuestions(content);
export const parseEnhancedPrompt = (content: string) => xmlParser.parseEnhancedPrompt(content);
export const processStreamingResearch = (textContent: string, processedContent?: Set<string>) =>
  xmlParser.processStreamingResearch(textContent, processedContent);
export const processStreamingClarifications = (textContent: string, existingQuestions?: ClarificationQuestion[]) =>
  xmlParser.processStreamingClarifications(textContent, existingQuestions);