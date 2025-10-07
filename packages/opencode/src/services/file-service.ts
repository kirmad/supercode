import fs from "node:fs/promises"
import path from "node:path"
import { Instance } from "../project/instance"
import { Log } from "../util/log"
import { NamedError } from "../util/error"

export namespace FileService {
  const log = Log.create({ service: "file-service" })

  export interface FileBackend {
    writeFile(filePath: string, content: string): Promise<void>
    readFile(filePath: string): Promise<string>
    deleteFile(filePath: string): Promise<void>
    deleteDirectory(dirPath: string): Promise<void>
    createDirectory(dirPath: string, recursive?: boolean): Promise<void>
    exists(path: string): Promise<boolean>
    listDirectory(dirPath: string): Promise<Array<{
      name: string
      path: string
      type: "file" | "directory"
      size?: number
      modified?: Date
    }>>
    stat(path: string): Promise<{
      type: "file" | "directory"
      size: number
      modified: Date
      created: Date
    }>
  }

  /**
   * Local filesystem backend implementation
   */
  export class LocalFileBackend implements FileBackend {
    constructor(private basePath?: string) {}

    private getBasePath(): string {
      return this.basePath || Instance.directory
    }

    private resolvePath(filePath: string): string {
      // Normalize and resolve the path
      const normalized = path.normalize(filePath)

      // Prevent path traversal attacks
      if (normalized.includes("..") || path.isAbsolute(normalized)) {
        throw new NamedError.BadRequest({
          message: "Path traversal not allowed",
          data: { path: filePath }
        })
      }

      return path.join(this.getBasePath(), normalized)
    }

    async writeFile(filePath: string, content: string): Promise<void> {
      const resolvedPath = this.resolvePath(filePath)

      // Ensure parent directory exists
      const parentDir = path.dirname(resolvedPath)
      await fs.mkdir(parentDir, { recursive: true })

      await fs.writeFile(resolvedPath, content, "utf-8")
      log.info("file written", { path: filePath, size: content.length })
    }

    async readFile(filePath: string): Promise<string> {
      const resolvedPath = this.resolvePath(filePath)

      try {
        const content = await fs.readFile(resolvedPath, "utf-8")
        log.info("file read", { path: filePath, size: content.length })
        return content
      } catch (error: any) {
        if (error.code === "ENOENT") {
          throw new NamedError.NotFound({
            message: "File not found",
            data: { path: filePath }
          })
        }
        throw new NamedError.Unknown({
          message: `Failed to read file: ${error.message}`
        })
      }
    }

    async deleteFile(filePath: string): Promise<void> {
      const resolvedPath = this.resolvePath(filePath)

      try {
        await fs.unlink(resolvedPath)
        log.info("file deleted", { path: filePath })
      } catch (error: any) {
        if (error.code === "ENOENT") {
          throw new NamedError.NotFound({
            message: "File not found",
            data: { path: filePath }
          })
        }
        throw new NamedError.Unknown({
          message: `Failed to delete file: ${error.message}`
        })
      }
    }

    async deleteDirectory(dirPath: string): Promise<void> {
      const resolvedPath = this.resolvePath(dirPath)

      try {
        await fs.rm(resolvedPath, { recursive: true, force: true })
        log.info("directory deleted", { path: dirPath })
      } catch (error: any) {
        if (error.code === "ENOENT") {
          throw new NamedError.NotFound({
            message: "Directory not found",
            data: { path: dirPath }
          })
        }
        throw new NamedError.Unknown({
          message: `Failed to delete directory: ${error.message}`
        })
      }
    }

    async createDirectory(dirPath: string, recursive: boolean = true): Promise<void> {
      const resolvedPath = this.resolvePath(dirPath)

      try {
        await fs.mkdir(resolvedPath, { recursive })
        log.info("directory created", { path: dirPath, recursive })
      } catch (error: any) {
        throw new NamedError.Unknown({
          message: `Failed to create directory: ${error.message}`
        })
      }
    }

    async exists(filePath: string): Promise<boolean> {
      const resolvedPath = this.resolvePath(filePath)

      try {
        await fs.access(resolvedPath)
        return true
      } catch {
        return false
      }
    }

    async listDirectory(dirPath: string): Promise<Array<{
      name: string
      path: string
      type: "file" | "directory"
      size?: number
      modified?: Date
    }>> {
      const resolvedPath = this.resolvePath(dirPath)

      try {
        const entries = await fs.readdir(resolvedPath, { withFileTypes: true })
        const results = []

        for (const entry of entries) {
          const entryPath = path.join(dirPath, entry.name)
          const entryType: "file" | "directory" = entry.isDirectory() ? "directory" : "file"

          let size: number | undefined
          let modified: Date | undefined

          try {
            const stats = await fs.stat(path.join(resolvedPath, entry.name))
            size = stats.size
            modified = stats.mtime
          } catch {
            // Ignore stat errors for individual entries
          }

          results.push({
            name: entry.name,
            path: entryPath,
            type: entryType,
            size,
            modified
          })
        }

        return results.sort((a, b) => {
          // Directories first, then alphabetical
          if (a.type !== b.type) {
            return a.type === "directory" ? -1 : 1
          }
          return a.name.localeCompare(b.name)
        })
      } catch (error: any) {
        if (error.code === "ENOENT") {
          throw new NamedError.NotFound({
            message: "Directory not found",
            data: { path: dirPath }
          })
        }
        throw new NamedError.Unknown({
          message: `Failed to list directory: ${error.message}`
        })
      }
    }

    async stat(filePath: string): Promise<{
      type: "file" | "directory"
      size: number
      modified: Date
      created: Date
    }> {
      const resolvedPath = this.resolvePath(filePath)

      try {
        const stats = await fs.stat(resolvedPath)
        return {
          type: stats.isDirectory() ? "directory" : "file",
          size: stats.size,
          modified: stats.mtime,
          created: stats.birthtime
        }
      } catch (error: any) {
        if (error.code === "ENOENT") {
          throw new NamedError.NotFound({
            message: "Path not found",
            data: { path: filePath }
          })
        }
        throw new NamedError.Unknown({
          message: `Failed to get file stats: ${error.message}`
        })
      }
    }
  }

  // Default backend - can be swapped for different implementations
  let defaultBackend: FileBackend = new LocalFileBackend()

  export function setDefaultBackend(backend: FileBackend): void {
    defaultBackend = backend
  }

  export function getDefaultBackend(): FileBackend {
    return defaultBackend
  }

  // Convenience methods that use the default backend
  export async function writeFile(filePath: string, content: string): Promise<void> {
    return defaultBackend.writeFile(filePath, content)
  }

  export async function readFile(filePath: string): Promise<string> {
    return defaultBackend.readFile(filePath)
  }

  export async function deleteFile(filePath: string): Promise<void> {
    return defaultBackend.deleteFile(filePath)
  }

  export async function deleteDirectory(dirPath: string): Promise<void> {
    return defaultBackend.deleteDirectory(dirPath)
  }

  export async function createDirectory(dirPath: string, recursive?: boolean): Promise<void> {
    return defaultBackend.createDirectory(dirPath, recursive)
  }

  export async function exists(path: string): Promise<boolean> {
    return defaultBackend.exists(path)
  }

  export async function listDirectory(dirPath: string) {
    return defaultBackend.listDirectory(dirPath)
  }

  export async function stat(path: string) {
    return defaultBackend.stat(path)
  }
}