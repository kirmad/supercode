/**
 * Tests for WorkflowFactory
 * Main entry point for the project-workflow system
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { WorkflowFactory, WorkflowType } from '../../src/index.js'
import type { WorkflowFactoryConfig, ReviewConfig } from '../../src/index.js'

describe('WorkflowFactory', () => {
  let mockConfig: WorkflowFactoryConfig

  beforeEach(() => {
    mockConfig = {
      baseUrl: 'http://localhost:3001',
      adoCredentials: {
        pat: 'test-token',
        organization: 'TestOrg'
      },
      defaults: {
        agent: 'test-agent',
        outputFormat: 'json',
        autoCleanup: true,
        maxParallelSessions: 2,
        optimalTokensPerShard: 5000
      }
    }
  })

  describe('constructor', () => {
    it('should create factory with valid configuration', () => {
      const factory = new WorkflowFactory(mockConfig)
      expect(factory).toBeDefined()
      expect(factory.getSupportedWorkflowTypes()).toContain(WorkflowType.REVIEW)
    })

    it('should throw validation error for missing baseUrl', () => {
      const invalidConfig = { ...mockConfig, baseUrl: '' }
      expect(() => new WorkflowFactory(invalidConfig)).toThrow('Base URL is required')
    })

    it('should throw validation error for missing ADO credentials', () => {
      const invalidConfig = { ...mockConfig, adoCredentials: undefined as any }
      expect(() => new WorkflowFactory(invalidConfig)).toThrow('ADO credentials are required')
    })

    it('should throw validation error for missing PAT token', () => {
      const invalidConfig = {
        ...mockConfig,
        adoCredentials: { pat: '', organization: 'TestOrg' }
      }
      expect(() => new WorkflowFactory(invalidConfig)).toThrow('ADO Personal Access Token is required')
    })
  })

  describe('createReviewWorkflow', () => {
    let factory: WorkflowFactory

    beforeEach(() => {
      factory = new WorkflowFactory(mockConfig)
    })

    it('should create review workflow with default configuration', () => {
      const workflow = factory.createReviewWorkflow()
      expect(workflow).toBeDefined()
      expect(workflow.validateInput).toBeDefined()
      expect(workflow.process).toBeDefined()
      expect(workflow.getMetadata).toBeDefined()
    })

    it('should create review workflow with overrides', () => {
      const overrides: Partial<ReviewConfig> = {
        agent: 'custom-agent',
        maxParallelSessions: 5,
        optimalTokensPerShard: 10000
      }

      const workflow = factory.createReviewWorkflow(overrides)
      expect(workflow).toBeDefined()
    })

    it('should apply factory defaults when no overrides provided', () => {
      const workflow = factory.createReviewWorkflow()
      expect(workflow).toBeDefined()

      const metadata = workflow.getMetadata()
      expect(metadata.type).toBe('review')
      expect(metadata.capabilities).toContain('ado-pr-processing')
    })
  })

  describe('createWorkflow', () => {
    let factory: WorkflowFactory

    beforeEach(() => {
      factory = new WorkflowFactory(mockConfig)
    })

    it('should create review workflow via generic method', () => {
      const workflow = factory.createWorkflow(WorkflowType.REVIEW)
      expect(workflow).toBeDefined()
      expect(workflow.getMetadata().type).toBe('review')
    })

    it('should throw error for unsupported workflow type', () => {
      expect(() => {
        factory.createWorkflow('unsupported' as WorkflowType)
      }).toThrow('Unsupported workflow type')
    })
  })

  describe('createWorkflowBatch', () => {
    let factory: WorkflowFactory

    beforeEach(() => {
      factory = new WorkflowFactory(mockConfig)
    })

    it('should create multiple workflow instances', () => {
      const workflows = factory.createWorkflowBatch(WorkflowType.REVIEW, 3)
      expect(workflows).toHaveLength(3)
      workflows.forEach(workflow => {
        expect(workflow).toBeDefined()
        expect(workflow.getMetadata().type).toBe('review')
      })
    })

    it('should throw error for invalid batch count', () => {
      expect(() => {
        factory.createWorkflowBatch(WorkflowType.REVIEW, 0)
      }).toThrow('Batch count must be positive')
    })
  })

  describe('createFromEnvironment', () => {
    const originalEnv = process.env

    beforeEach(() => {
      // Reset env
      process.env = { ...originalEnv }
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('should create factory from environment variables', () => {
      process.env['OPENCODE_BASE_URL'] = 'http://test:4000'
      process.env['ADO_PAT'] = 'env-token'

      const factory = WorkflowFactory.createFromEnvironment()
      expect(factory).toBeDefined()

      const config = factory.getConfig()
      expect(config.baseUrl).toBe('http://test:4000')
      expect(config.adoCredentials.pat).toBe('env-token')
    })

    it('should use default values when env vars not set', () => {
      delete process.env['OPENCODE_BASE_URL']
      delete process.env['ADO_PAT']
      delete process.env['AZURE_DEVOPS_PAT']

      const factory = WorkflowFactory.createFromEnvironment()
      expect(factory).toBeDefined()

      const config = factory.getConfig()
      expect(config.baseUrl).toBe('http://localhost:3001')
      expect(config.adoCredentials.pat).toBeUndefined()
    })

    it('should apply overrides to environment config', () => {
      const overrides: Partial<WorkflowFactoryConfig> = {
        defaults: {
          maxParallelSessions: 10
        }
      }

      const factory = WorkflowFactory.createFromEnvironment(overrides)
      expect(factory).toBeDefined()

      const config = factory.getConfig()
      expect(config.defaults?.maxParallelSessions).toBe(10)
    })
  })

  describe('validation', () => {
    it('should validate max parallel sessions', () => {
      const invalidConfig = {
        ...mockConfig,
        defaults: {
          ...mockConfig.defaults,
          maxParallelSessions: 0
        }
      }

      expect(() => new WorkflowFactory(invalidConfig)).toThrow('Max parallel sessions must be at least 1')
    })

    it('should validate timeout per shard', () => {
      const invalidConfig = {
        ...mockConfig,
        defaults: {
          ...mockConfig.defaults,
          timeoutPerShard: 500
        }
      }

      expect(() => new WorkflowFactory(invalidConfig)).toThrow('Timeout per shard must be at least 1000ms')
    })

    it('should validate token constraints', () => {
      const invalidConfig = {
        ...mockConfig,
        defaults: {
          ...mockConfig.defaults,
          optimalTokensPerShard: 500
        }
      }

      expect(() => new WorkflowFactory(invalidConfig)).toThrow('Optimal tokens per shard must be at least 1000')
    })

    it('should validate max vs optimal tokens', () => {
      const invalidConfig = {
        ...mockConfig,
        defaults: {
          ...mockConfig.defaults,
          optimalTokensPerShard: 8000,
          maxTokensPerShard: 7000
        }
      }

      expect(() => new WorkflowFactory(invalidConfig)).toThrow('Max tokens per shard must be greater than optimal tokens per shard')
    })
  })

  describe('configuration management', () => {
    it('should return read-only configuration', () => {
      const factory = new WorkflowFactory(mockConfig)
      const config = factory.getConfig()

      expect(config).toBeDefined()
      expect(config.baseUrl).toBe(mockConfig.baseUrl)

      // Should be frozen (read-only)
      expect(() => {
        (config as any).baseUrl = 'modified'
      }).toThrow()
    })

    it('should list supported workflow types', () => {
      const factory = new WorkflowFactory(mockConfig)
      const types = factory.getSupportedWorkflowTypes()

      expect(types).toContain(WorkflowType.REVIEW)
      expect(types.length).toBeGreaterThan(0)
    })
  })
})