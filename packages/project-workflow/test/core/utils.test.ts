/**
 * Tests for core utility functions
 * Essential functions used throughout the project-workflow system
 */

import { describe, it, expect } from 'bun:test'
import {
  estimateTokens,
  detectSourceType,
  parseADOUrl,
  isADOUrl,
  sanitizeFileName,
  formatFileSize,
  formatDuration,
  generateId,
  createHash,
  retry,
  sleep,
  ValidationError,
  ProcessingError,
  ContentSourceError,
  ShardingError,
  AggregationError
} from '../../src/index.js'
import { SourceType } from '../../src/index.js'

describe('Utility Functions', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens for text content', () => {
      const text = 'Hello world, this is a test string'
      const tokens = estimateTokens(text)
      expect(tokens).toBeGreaterThan(0)
      expect(tokens).toBe(Math.ceil(text.length / 4)) // ~4 chars per token
    })

    it('should return 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0)
    })

    it('should handle unicode characters', () => {
      const unicodeText = '你好世界 🌍 こんにちは'
      const tokens = estimateTokens(unicodeText)
      expect(tokens).toBeGreaterThan(0)
    })
  })

  describe('detectSourceType', () => {
    it('should detect ADO PR URLs', () => {
      const adoUrl = 'https://dev.azure.com/MicrosoftIT/OneITVSO/_git/supercode/pullrequest/2084'
      expect(detectSourceType(adoUrl)).toBe(SourceType.ADO_PR)
    })

    it('should detect GitHub PR URLs', () => {
      const githubUrl = 'https://github.com/user/repo/pull/123'
      expect(detectSourceType(githubUrl)).toBe(SourceType.GITHUB_PR)
    })

    it('should detect Git URLs', () => {
      const gitUrl = 'https://github.com/user/repo.git'
      expect(detectSourceType(gitUrl)).toBe(SourceType.GIT)
    })

    it('should return LOCAL for unrecognized URLs', () => {
      const localPath = '/path/to/local/directory'
      expect(detectSourceType(localPath)).toBe(SourceType.LOCAL)
    })
  })

  describe('parseADOUrl', () => {
    it('should parse valid ADO PR URL', () => {
      const url = 'https://dev.azure.com/MicrosoftIT/OneITVSO/_git/supercode/pullrequest/2084'
      const parsed = parseADOUrl(url)

      expect(parsed).toEqual({
        organization: 'MicrosoftIT',
        project: 'OneITVSO',
        repository: 'supercode',
        pullRequestId: '2084'
      })
    })

    it('should handle ADO URLs with different patterns', () => {
      const url = 'https://microsoft.visualstudio.com/DefaultCollection/Project/_git/repo/pullrequest/456'
      const parsed = parseADOUrl(url)

      expect(parsed.organization).toBeDefined()
      expect(parsed.pullRequestId).toBe('456')
    })

    it('should return null for invalid URLs', () => {
      const invalidUrl = 'https://github.com/user/repo/pull/123'
      expect(parseADOUrl(invalidUrl)).toBeNull()
    })
  })

  describe('isADOUrl', () => {
    it('should return true for valid ADO URLs', () => {
      const adoUrls = [
        'https://dev.azure.com/org/project/_git/repo/pullrequest/123',
        'https://org.visualstudio.com/project/_git/repo/pullrequest/456'
      ]

      adoUrls.forEach(url => {
        expect(isADOUrl(url)).toBe(true)
      })
    })

    it('should return false for non-ADO URLs', () => {
      const nonAdoUrls = [
        'https://github.com/user/repo',
        'https://gitlab.com/user/repo',
        'https://example.com'
      ]

      nonAdoUrls.forEach(url => {
        expect(isADOUrl(url)).toBe(false)
      })
    })
  })

  describe('sanitizeFileName', () => {
    it('should sanitize invalid file name characters', () => {
      const unsafeName = 'file<name>with|invalid*chars?.txt'
      const sanitized = sanitizeFileName(unsafeName)
      expect(sanitized).not.toContain('<')
      expect(sanitized).not.toContain('>')
      expect(sanitized).not.toContain('|')
      expect(sanitized).not.toContain('*')
      expect(sanitized).not.toContain('?')
    })

    it('should preserve valid file name characters', () => {
      const safeName = 'valid-file_name.123.txt'
      const sanitized = sanitizeFileName(safeName)
      expect(sanitized).toBe(safeName)
    })

    it('should handle empty string', () => {
      expect(sanitizeFileName('')).toBe('')
    })
  })

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(500)).toBe('500 B')
      expect(formatFileSize(1024)).toBe('1.0 KB')
      expect(formatFileSize(1536)).toBe('1.5 KB')
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB')
    })

    it('should handle zero and negative values', () => {
      expect(formatFileSize(0)).toBe('0 B')
      expect(formatFileSize(-100)).toBe('0 B')
    })
  })

  describe('formatDuration', () => {
    it('should format milliseconds correctly', () => {
      expect(formatDuration(500)).toBe('500ms')
      expect(formatDuration(1000)).toBe('1s')
      expect(formatDuration(1500)).toBe('1.5s')
      expect(formatDuration(60000)).toBe('1m 0s')
      expect(formatDuration(90000)).toBe('1m 30s')
      expect(formatDuration(3600000)).toBe('1h 0m 0s')
    })

    it('should handle zero duration', () => {
      expect(formatDuration(0)).toBe('0ms')
    })
  })

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId('test')
      const id2 = generateId('test')
      expect(id1).not.toBe(id2)
      expect(id1).toContain('test')
      expect(id2).toContain('test')
    })

    it('should generate ID without prefix', () => {
      const id = generateId()
      expect(id).toBeDefined()
      expect(id.length).toBeGreaterThan(0)
    })
  })

  describe('createHash', () => {
    it('should create consistent hashes', () => {
      const input = 'test string'
      const hash1 = createHash(input)
      const hash2 = createHash(input)
      expect(hash1).toBe(hash2)
      expect(hash1.length).toBeGreaterThan(0)
    })

    it('should create different hashes for different inputs', () => {
      const hash1 = createHash('input1')
      const hash2 = createHash('input2')
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('retry', () => {
    it('should succeed on first attempt', async () => {
      let attempts = 0
      const successFn = async () => {
        attempts++
        return 'success'
      }

      const result = await retry(successFn, { attempts: 3, delay: 10 })
      expect(result).toBe('success')
      expect(attempts).toBe(1)
    })

    it('should retry on failure and eventually succeed', async () => {
      let attempts = 0
      const flakyFn = async () => {
        attempts++
        if (attempts < 3) {
          throw new Error('Temporary failure')
        }
        return 'success'
      }

      const result = await retry(flakyFn, { attempts: 5, delay: 10 })
      expect(result).toBe('success')
      expect(attempts).toBe(3)
    })

    it('should fail after max attempts', async () => {
      let attempts = 0
      const alwaysFailFn = async () => {
        attempts++
        throw new Error('Always fails')
      }

      await expect(
        retry(alwaysFailFn, { attempts: 3, delay: 10 })
      ).rejects.toThrow('Always fails')
      expect(attempts).toBe(3)
    })

    it('should respect shouldRetry function', async () => {
      let attempts = 0
      const flakyFn = async () => {
        attempts++
        throw new Error('Special error')
      }

      await expect(
        retry(flakyFn, {
          attempts: 3,
          delay: 10,
          shouldRetry: (error) => !error.message.includes('Special')
        })
      ).rejects.toThrow('Special error')
      expect(attempts).toBe(1) // Should not retry
    })
  })

  describe('sleep', () => {
    it('should delay execution', async () => {
      const start = Date.now()
      await sleep(50)
      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(45) // Allow some timing variance
    })
  })
})

describe('Error Classes', () => {
  describe('ValidationError', () => {
    it('should create validation error with message and code', () => {
      const error = new ValidationError('Invalid input', 'CUSTOM_CODE')
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(ValidationError)
      expect(error.message).toBe('Invalid input')
      expect(error.code).toBe('CUSTOM_CODE')
      expect(error.name).toBe('ValidationError')
    })

    it('should use default code when not provided', () => {
      const error = new ValidationError('Invalid input')
      expect(error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('ProcessingError', () => {
    it('should create processing error', () => {
      const error = new ProcessingError('Processing failed')
      expect(error).toBeInstanceOf(ProcessingError)
      expect(error.message).toBe('Processing failed')
      expect(error.code).toBe('PROCESSING_ERROR')
    })
  })

  describe('ContentSourceError', () => {
    it('should create content source error', () => {
      const error = new ContentSourceError('Failed to fetch content')
      expect(error).toBeInstanceOf(ContentSourceError)
      expect(error.message).toBe('Failed to fetch content')
      expect(error.code).toBe('CONTENT_SOURCE_ERROR')
    })
  })

  describe('ShardingError', () => {
    it('should create sharding error', () => {
      const error = new ShardingError('Sharding failed')
      expect(error).toBeInstanceOf(ShardingError)
      expect(error.message).toBe('Sharding failed')
      expect(error.code).toBe('SHARDING_ERROR')
    })
  })

  describe('AggregationError', () => {
    it('should create aggregation error', () => {
      const error = new AggregationError('Aggregation failed')
      expect(error).toBeInstanceOf(AggregationError)
      expect(error.message).toBe('Aggregation failed')
      expect(error.code).toBe('AGGREGATION_ERROR')
    })
  })
})