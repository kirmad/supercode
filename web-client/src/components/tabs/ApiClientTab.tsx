import { useEffect, useRef } from "react"
import { useTheme } from "@/hooks/use-theme"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

declare global {
  interface Window {
    Scalar: {
      createApiReference: (container: HTMLElement, config: any) => void
    }
  }
}

interface ApiClientTabProps {
  onStatusChange: (status: "loading" | "ready" | "error") => void
}

export function ApiClientTab({ onStatusChange }: ApiClientTabProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()
  const loadedRef = useRef(false)

  useEffect(() => {
    if (!containerRef.current || loadedRef.current) return

    loadScalarClient()
  }, [theme])

  const loadScalarClient = async () => {
    if (!containerRef.current) return

    try {
      onStatusChange("loading")
      
      // Clear any existing content
      containerRef.current.innerHTML = ""
      
      // Wait for Scalar to be available
      let attempts = 0
      while (typeof window.Scalar === 'undefined' && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++
      }
      
      if (typeof window.Scalar === 'undefined') {
        throw new Error('Scalar library failed to load')
      }
      
      // Configure Scalar with theme
      const config = {
        url: `${window.APP_CONFIG.apiUrl}/doc`,
        theme: theme === 'dark' ? 'mars' : 'default'
      }
      
      // Initialize Scalar
      window.Scalar.createApiReference(containerRef.current, config)
      
      loadedRef.current = true
      onStatusChange("ready")
      
    } catch (error) {
      console.error('Failed to load API client:', error)
      onStatusChange("error")
      
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div class="flex items-center justify-center h-full">
            <div class="text-center text-muted-foreground">
              <div class="mb-4">
                <svg class="w-12 h-12 mx-auto text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
              </div>
              <p class="text-lg mb-2">Failed to load API documentation</p>
              <p class="text-sm mb-4 text-muted-foreground">${(error as Error).message}</p>
            </div>
          </div>
        `
      }
    }
  }

  const resetAndRetry = () => {
    loadedRef.current = false
    if (containerRef.current) {
      containerRef.current.innerHTML = ""
    }
    loadScalarClient()
  }

  return (
    <div className="h-full flex flex-col">
      <div ref={containerRef} className="flex-1 w-full">
        {/* Scalar will be loaded here */}
      </div>
      
      {/* Retry button overlay for errors */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto">
          <Button 
            onClick={resetAndRetry}
            variant="outline"
            className="hidden group-[.error]:block"
          >
            <AlertCircle className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    </div>
  )
}