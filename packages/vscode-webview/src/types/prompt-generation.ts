/**
 * Prompt Generation Types
 * Shared types for the prompt generation feature
 */

export interface ResearchItem {
  id: string;
  type: 'analysis' | 'pattern' | 'requirement' | 'best-practice' | 'clarification';
  priority: 'high' | 'medium' | 'low';
  content: string;
  timestamp: number;
  status: 'pending' | 'in-progress' | 'completed';
}

export interface ClarificationQuestion {
  id: string;
  text: string;
  type?: 'text' | 'choice';
  options?: Array<{
    value: string;
    label: string;
  }>;
  answer?: string;
}

export interface EnhancedPromptMetadata {
  complexity?: 'simple' | 'moderate' | 'complex';
  domains?: string[];
  technologies?: string[];
  patterns?: string[];
  sources?: string[];
}