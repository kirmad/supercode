import { Format } from "../format"
import { LSP } from "../lsp"
import { Plugin } from "../plugin"
import { Instance } from "../project/instance"
import { Share } from "../share/share"
import { Snapshot } from "../snapshot"
import { HttpFileLogger } from "../session/http-file-logger"
import { HttpInterceptor } from "../session/http-interceptor"

export async function bootstrap<T>(directory: string, cb: () => Promise<T>) {
  return Instance.provide(directory, async () => {
    await Plugin.init()
    Share.init()
    Format.init()
    LSP.init()
    Snapshot.init()
    
    // Initialize HTTP file logger and schedule cleanup
    await HttpFileLogger.init()
    
    // Initialize HTTP interceptor to capture raw requests/responses
    HttpInterceptor.init()
    
    // Run cleanup every 24 hours if HTTP logging is enabled
    if (HttpFileLogger.isEnabled()) {
      const cleanupInterval = setInterval(() => {
        HttpFileLogger.cleanup().catch(console.error)
      }, 24 * 60 * 60 * 1000) // 24 hours
      
      // Clean up on exit
      process.on('exit', () => {
        clearInterval(cleanupInterval)
        HttpInterceptor.disable()
      })
    }

    const result = await cb()
    await Instance.dispose()
    return result
  })
}
