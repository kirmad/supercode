import { ThemeProvider } from "@/hooks/use-theme"
import { MainLayout } from "@/components/MainLayout"
import "./index.css"

declare global {
  interface Window {
    APP_CONFIG: {
      apiUrl: string
      webUrl: string
    }
  }
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="supercode-theme">
      <MainLayout />
    </ThemeProvider>
  )
}

export default App