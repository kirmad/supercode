import { Code, Sun, Moon, Terminal, Bug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTheme } from "@/hooks/use-theme"
import { ApiClientTab } from "@/components/tabs/ApiClientTab"
import { SessionsTab } from "@/components/tabs/SessionsTab"
import { LogsTab } from "@/components/tabs/LogsTab"
import { DebugLogsTab } from "@/components/tabs/DebugLogsTab"
import { TuiTab } from "@/components/tabs/TuiTab"
import { useState } from "react"

export function MainLayout() {
  const { theme, toggleTheme } = useTheme()
  const [apiStatus, setApiStatus] = useState<"loading" | "ready" | "error">("loading")
  
  // Check if we're in chat-only mode
  const chatOnlyMode = (window as any).APP_CONFIG?.chatOnlyMode === true
  
  // Set the default tab based on mode
  const defaultTab = chatOnlyMode ? "tui" : "api-client"

  return (
    <div className="flex h-screen flex-col">
      {/* Header - Hidden in chat-only mode */}
      {!chatOnlyMode && (
        <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600">
            <Code className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-lg font-semibold">SuperCode</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          title="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
      </header>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue={defaultTab} className="flex h-full flex-col">
          {/* Tab Navigation - Hidden in chat-only mode */}
          {!chatOnlyMode && (
            <div className="flex items-center justify-between border-b px-6">
            <TabsList className="bg-transparent p-0 h-auto gap-0">
              <TabsTrigger 
                value="api-client" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent px-4 py-3"
              >
                <Code className="mr-2 h-4 w-4" />
                API Client
              </TabsTrigger>
              <TabsTrigger 
                value="sessions"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent px-4 py-3"
              >
                Sessions
              </TabsTrigger>
              <TabsTrigger 
                value="logs"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent px-4 py-3"
              >
                Logs
              </TabsTrigger>
              <TabsTrigger 
                value="debug-logs"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent px-4 py-3"
              >
                <Bug className="mr-2 h-4 w-4" />
                Debug Logs
              </TabsTrigger>
              <TabsTrigger 
                value="tui"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent px-4 py-3"
              >
                <Terminal className="mr-2 h-4 w-4" />
                TUI
              </TabsTrigger>
            </TabsList>
            
            {/* Status indicator */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {apiStatus === "loading" && (
                <>
                  <div className="spinner"></div>
                  <span>Loading...</span>
                </>
              )}
              {apiStatus === "ready" && (
                <>
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span>Ready</span>
                </>
              )}
              {apiStatus === "error" && (
                <>
                  <div className="h-2 w-2 rounded-full bg-red-500"></div>
                  <span>Error</span>
                </>
              )}
            </div>
          </div>
          )}

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            <TabsContent value="api-client" className="h-full m-0">
              <ApiClientTab onStatusChange={setApiStatus} />
            </TabsContent>
            <TabsContent value="sessions" className="h-full m-0">
              <SessionsTab />
            </TabsContent>
            <TabsContent value="logs" className="h-full m-0">
              <LogsTab />
            </TabsContent>
            <TabsContent value="debug-logs" className="h-full m-0">
              <DebugLogsTab />
            </TabsContent>
            <TabsContent value="tui" className="h-full m-0">
              <TuiTab />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}