/**
 * Plan Generation Types
 * Defines interfaces for the design and planning phase with thought tracking
 */

export interface DesignThought {
  id: string;
  type: 'exploration' | 'architecture' | 'integration' | 'dependency' | 'pattern' | 'decision' | 'constraint';
  priority: 'critical' | 'high' | 'medium' | 'low';
  content: string;
  timestamp: number;
  status: 'pending' | 'in-progress' | 'completed';
}

export interface DesignMetadata {
  timestamp: number;
  confidence: 'very-high' | 'high' | 'medium' | 'low';
  complexity: 'simple' | 'moderate' | 'complex' | 'very-complex';
  estimatedEffort: string;  // e.g., "2-3 days", "1-2 weeks"
  risks: string[];
  dependencies: string[];
  technologies?: string[];
  patterns?: string[];
  domains?: string[];
}

export interface DesignSpecification {
  specification: string;
  metadata: DesignMetadata;
}

export interface PlanGenerationResult {
  thoughts: DesignThought[];
  specification: DesignSpecification | null;
  processingTime: number;
}

export interface PlanGenerationState {
  isGenerating: boolean;
  thoughts: DesignThought[];
  specification: DesignSpecification | null;
  error: string | null;
  sessionId: string | null;
}

export interface PlanGenerationOptions {
  originalPrompt: string;
  providerId?: string;
  modelId?: string;
  sources?: any[]; // Can be extended to include ADO sources or other context
  selectedRelatedItems?: Record<string, any>;
}

export interface PlanGenerationProgress {
  phase: string;
  percentage: number;
  currentThought?: string;
}