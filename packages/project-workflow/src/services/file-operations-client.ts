export interface FileOperationsClientConfig {
  baseUrl: string;
  timeout?: number;
}

export interface FileInfo {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
}

export interface WriteFileOptions {
  encoding?: 'utf8' | 'base64';
  createDirs?: boolean;
}

export interface ReadFileOptions {
  encoding?: 'utf8' | 'base64';
}

export interface CreateDirectoryOptions {
  recursive?: boolean;
}

export interface ListDirectoryOptions {
  includeHidden?: boolean;
  recursive?: boolean;
}

export class FileOperationsClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config: FileOperationsClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = config.timeout || 30000; // 30 second default timeout
  }

  /**
   * Write content to a file
   */
  async writeFile(path: string, content: string, options: WriteFileOptions = {}): Promise<void> {
    const response = await this.makeRequest('/api/files/write', {
      method: 'POST',
      body: JSON.stringify({
        path,
        content,
        encoding: options.encoding || 'utf8',
        createDirs: options.createDirs || false
      })
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      throw new Error(`Failed to write file ${path}: ${error}`);
    }
  }

  /**
   * Read content from a file
   */
  async readFile(path: string, options: ReadFileOptions = {}): Promise<string> {
    const params = new URLSearchParams({
      path,
      encoding: options.encoding || 'utf8'
    });

    const response = await this.makeRequest(`/api/files/read?${params}`, {
      method: 'GET'
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      throw new Error(`Failed to read file ${path}: ${error}`);
    }

    const result = await response.json();
    return result.content;
  }

  /**
   * Create a directory
   */
  async createDirectory(path: string, options: CreateDirectoryOptions = {}): Promise<void> {
    const response = await this.makeRequest('/api/files/mkdir', {
      method: 'POST',
      body: JSON.stringify({
        path,
        recursive: options.recursive !== false // Default to true
      })
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      throw new Error(`Failed to create directory ${path}: ${error}`);
    }
  }

  /**
   * Delete a directory and its contents
   */
  async deleteDirectory(path: string): Promise<void> {
    const response = await this.makeRequest('/api/files/rmdir', {
      method: 'DELETE',
      body: JSON.stringify({
        path,
        recursive: true
      })
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      throw new Error(`Failed to delete directory ${path}: ${error}`);
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(path: string): Promise<void> {
    const response = await this.makeRequest('/api/files/delete', {
      method: 'DELETE',
      body: JSON.stringify({
        path
      })
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      throw new Error(`Failed to delete file ${path}: ${error}`);
    }
  }

  /**
   * Check if a file or directory exists
   */
  async exists(path: string): Promise<boolean> {
    const params = new URLSearchParams({ path });

    const response = await this.makeRequest(`/api/files/exists?${params}`, {
      method: 'GET'
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      throw new Error(`Failed to check existence of ${path}: ${error}`);
    }

    const result = await response.json();
    return result.exists;
  }

  /**
   * List directory contents
   */
  async listDirectory(path: string, options: ListDirectoryOptions = {}): Promise<FileInfo[]> {
    const params = new URLSearchParams({
      path,
      includeHidden: String(options.includeHidden || false),
      recursive: String(options.recursive || false)
    });

    const response = await this.makeRequest(`/api/files/list?${params}`, {
      method: 'GET'
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      throw new Error(`Failed to list directory ${path}: ${error}`);
    }

    const result = await response.json();
    return result.entries;
  }

  /**
   * Get file or directory information
   */
  async stat(path: string): Promise<FileInfo> {
    const params = new URLSearchParams({ path });

    const response = await this.makeRequest(`/api/file-operations/stat?${params}`, {
      method: 'GET'
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      throw new Error(`Failed to get stats for ${path}: ${error}`);
    }

    return response.json();
  }

  /**
   * Copy a file or directory
   */
  async copy(source: string, destination: string, options: { recursive?: boolean } = {}): Promise<void> {
    const response = await this.makeRequest('/api/file-operations/copy', {
      method: 'POST',
      body: JSON.stringify({
        source,
        destination,
        recursive: options.recursive || false
      })
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      throw new Error(`Failed to copy ${source} to ${destination}: ${error}`);
    }
  }

  /**
   * Move/rename a file or directory
   */
  async move(source: string, destination: string): Promise<void> {
    const response = await this.makeRequest('/api/file-operations/move', {
      method: 'POST',
      body: JSON.stringify({
        source,
        destination
      })
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      throw new Error(`Failed to move ${source} to ${destination}: ${error}`);
    }
  }

  /**
   * Make HTTP request with timeout and error handling
   */
  private async makeRequest(endpoint: string, options: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse error response
   */
  private async parseError(response: Response): Promise<string> {
    try {
      const errorData = await response.json();
      return errorData.error || errorData.message || `HTTP ${response.status}`;
    } catch {
      return `HTTP ${response.status} ${response.statusText}`;
    }
  }
}

/**
 * Create a configured file operations client
 */
export function createFileOperationsClient(config: FileOperationsClientConfig): FileOperationsClient {
  return new FileOperationsClient(config);
}

/**
 * Default client configuration for local development
 */
export const defaultLocalConfig: FileOperationsClientConfig = {
  baseUrl: 'http://localhost:3000',
  timeout: 30000
};