/**
 * Browser-compatible configuration service to replace process.env access
 *
 * This service provides a centralized way to manage configuration values
 * in browser environments where process.env is not available.
 *
 * Features:
 * - Runtime configuration management
 * - Optional localStorage persistence
 * - Type-safe configuration access
 * - Validation for required configurations
 * - Special handling for Azure DevOps PAT tokens
 *
 * @example
 * ```typescript
 * // Initialize at application startup
 * BrowserConfig.loadConfig({
 *   'AZURE_DEVOPS_PAT': 'your-pat-token',
 *   'API_BASE_URL': 'https://api.example.com'
 * });
 *
 * // Use throughout the application
 * const pat = BrowserConfig.getConfig('AZURE_DEVOPS_PAT');
 * ```
 */

interface ConfigOptions {
  /** Whether to persist configuration to localStorage */
  persist?: boolean;
  /** Storage key prefix for localStorage */
  storagePrefix?: string;
  /** Whether to validate required configurations on load */
  validateRequired?: boolean;
}

interface ConfigValidation {
  /** Configuration keys that are required */
  required?: string[];
  /** Custom validation function */
  validator?: (key: string, value: string) => boolean;
}

/**
 * Browser-compatible configuration service
 */
class BrowserConfigService {
  private config: Map<string, string> = new Map();
  private options: Required<ConfigOptions>;
  private validation: ConfigValidation = {};

  constructor(options: ConfigOptions = {}) {
    this.options = {
      persist: false,
      storagePrefix: 'browser-config',
      validateRequired: true,
      ...options
    };

    // Load from localStorage if persistence is enabled
    if (this.options.persist && typeof localStorage !== 'undefined') {
      this.loadFromStorage();
    }
  }

  /**
   * Get a configuration value by key
   *
   * @param key - Configuration key
   * @returns Configuration value or undefined if not found
   *
   * @example
   * ```typescript
   * const apiUrl = BrowserConfig.getConfig('API_BASE_URL');
   * const pat = BrowserConfig.getConfig('AZURE_DEVOPS_PAT');
   * ```
   */
  getConfig(key: string): string | undefined {
    // Handle Azure DevOps PAT token aliases
    if (key === 'ADO_PAT' && !this.config.has(key)) {
      return this.config.get('AZURE_DEVOPS_PAT');
    }
    if (key === 'AZURE_DEVOPS_PAT' && !this.config.has(key)) {
      return this.config.get('ADO_PAT');
    }

    return this.config.get(key);
  }

  /**
   * Set a configuration value
   *
   * @param key - Configuration key
   * @param value - Configuration value
   *
   * @example
   * ```typescript
   * BrowserConfig.setConfig('API_TIMEOUT', '5000');
   * BrowserConfig.setConfig('AZURE_DEVOPS_PAT', 'new-token');
   * ```
   */
  setConfig(key: string, value: string): void {
    // Validate the configuration if validator is provided
    if (this.validation.validator && !this.validation.validator(key, value)) {
      throw new Error(`Invalid configuration value for key: ${key}`);
    }

    this.config.set(key, value);

    // Persist to localStorage if enabled
    if (this.options.persist && typeof localStorage !== 'undefined') {
      this.saveToStorage(key, value);
    }
  }

  /**
   * Check if a configuration key exists
   *
   * @param key - Configuration key
   * @returns True if the key exists, false otherwise
   *
   * @example
   * ```typescript
   * if (BrowserConfig.hasConfig('AZURE_DEVOPS_PAT')) {
   *   // Use Azure DevOps functionality
   * }
   * ```
   */
  hasConfig(key: string): boolean {
    // Handle Azure DevOps PAT token aliases
    if (key === 'ADO_PAT' || key === 'AZURE_DEVOPS_PAT') {
      return this.config.has('AZURE_DEVOPS_PAT') || this.config.has('ADO_PAT');
    }

    return this.config.has(key);
  }

  /**
   * Get all configuration values
   *
   * @returns Record of all configuration key-value pairs
   *
   * @example
   * ```typescript
   * const allConfig = BrowserConfig.getAllConfig();
   * console.log('Current configuration:', allConfig);
   * ```
   */
  getAllConfig(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of this.config.entries()) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Load multiple configuration values at once
   *
   * @param config - Record of configuration key-value pairs
   * @param options - Loading options
   *
   * @example
   * ```typescript
   * BrowserConfig.loadConfig({
   *   'AZURE_DEVOPS_PAT': 'your-pat-token',
   *   'API_BASE_URL': 'https://api.example.com',
   *   'DEBUG_MODE': 'true'
   * });
   * ```
   */
  loadConfig(config: Record<string, string>, options?: { merge?: boolean }): void {
    const shouldMerge = options?.merge ?? true;

    if (!shouldMerge) {
      this.config.clear();
    }

    for (const [key, value] of Object.entries(config)) {
      this.setConfig(key, value);
    }

    // Validate required configurations if enabled
    if (this.options.validateRequired) {
      this.validateRequiredConfigs();
    }
  }

  /**
   * Set validation rules for configurations
   *
   * @param validation - Validation configuration
   *
   * @example
   * ```typescript
   * BrowserConfig.setValidation({
   *   required: ['AZURE_DEVOPS_PAT', 'API_BASE_URL'],
   *   validator: (key, value) => {
   *     if (key.endsWith('_URL')) {
   *       return value.startsWith('http');
   *     }
   *     return true;
   *   }
   * });
   * ```
   */
  setValidation(validation: ConfigValidation): void {
    this.validation = { ...this.validation, ...validation };
  }

  /**
   * Clear all configuration values
   *
   * @example
   * ```typescript
   * BrowserConfig.clearConfig();
   * ```
   */
  clearConfig(): void {
    this.config.clear();

    if (this.options.persist && typeof localStorage !== 'undefined') {
      this.clearStorage();
    }
  }

  /**
   * Remove a specific configuration key
   *
   * @param key - Configuration key to remove
   * @returns True if the key was removed, false if it didn't exist
   *
   * @example
   * ```typescript
   * BrowserConfig.removeConfig('TEMPORARY_TOKEN');
   * ```
   */
  removeConfig(key: string): boolean {
    const existed = this.config.delete(key);

    if (existed && this.options.persist && typeof localStorage !== 'undefined') {
      localStorage.removeItem(`${this.options.storagePrefix}:${key}`);
    }

    return existed;
  }

  /**
   * Get configuration with a default value
   *
   * @param key - Configuration key
   * @param defaultValue - Default value if key is not found
   * @returns Configuration value or default value
   *
   * @example
   * ```typescript
   * const timeout = BrowserConfig.getConfigWithDefault('API_TIMEOUT', '30000');
   * ```
   */
  getConfigWithDefault(key: string, defaultValue: string): string {
    return this.getConfig(key) ?? defaultValue;
  }

  /**
   * Check if Azure DevOps PAT token is available
   *
   * @returns True if either AZURE_DEVOPS_PAT or ADO_PAT is configured
   *
   * @example
   * ```typescript
   * if (BrowserConfig.hasAzureDevOpsPat()) {
   *   // Initialize Azure DevOps client
   * }
   * ```
   */
  hasAzureDevOpsPat(): boolean {
    return this.hasConfig('AZURE_DEVOPS_PAT') || this.hasConfig('ADO_PAT');
  }

  /**
   * Get Azure DevOps PAT token (checks both possible keys)
   *
   * @returns Azure DevOps PAT token or undefined
   *
   * @example
   * ```typescript
   * const pat = BrowserConfig.getAzureDevOpsPat();
   * if (pat) {
   *   // Use PAT for authentication
   * }
   * ```
   */
  getAzureDevOpsPat(): string | undefined {
    return this.getConfig('AZURE_DEVOPS_PAT') ?? this.getConfig('ADO_PAT');
  }

  /**
   * Validate that all required configurations are present
   *
   * @throws Error if required configurations are missing
   */
  private validateRequiredConfigs(): void {
    if (!this.validation.required || this.validation.required.length === 0) {
      return;
    }

    const missing: string[] = [];

    for (const key of this.validation.required) {
      if (!this.hasConfig(key)) {
        missing.push(key);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required configuration keys: ${missing.join(', ')}`);
    }
  }

  /**
   * Load configuration from localStorage
   */
  private loadFromStorage(): void {
    try {
      const keys = Object.keys(localStorage);
      const prefix = `${this.options.storagePrefix}:`;

      for (const key of keys) {
        if (key.startsWith(prefix)) {
          const configKey = key.substring(prefix.length);
          const value = localStorage.getItem(key);
          if (value !== null) {
            this.config.set(configKey, value);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load configuration from localStorage:', error);
    }
  }

  /**
   * Save configuration to localStorage
   */
  private saveToStorage(key: string, value: string): void {
    try {
      localStorage.setItem(`${this.options.storagePrefix}:${key}`, value);
    } catch (error) {
      console.warn(`Failed to save configuration to localStorage: ${key}`, error);
    }
  }

  /**
   * Clear all configuration from localStorage
   */
  private clearStorage(): void {
    try {
      const keys = Object.keys(localStorage);
      const prefix = `${this.options.storagePrefix}:`;

      for (const key of keys) {
        if (key.startsWith(prefix)) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.warn('Failed to clear configuration from localStorage:', error);
    }
  }
}

// Create and export a singleton instance
export const BrowserConfig = new BrowserConfigService({
  persist: true,
  storagePrefix: 'project-workflow-config',
  validateRequired: true
});

// Export the class for custom instances if needed
export { BrowserConfigService };
export type { ConfigOptions, ConfigValidation };

// Default export for convenience
export default BrowserConfig;