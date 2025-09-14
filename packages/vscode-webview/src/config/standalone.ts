// Configuration for standalone mode

export function getServerPort(): number {
  // Check if we're in standalone mode
  if (import.meta.env.VITE_STANDALONE === true || import.meta.env.VITE_STANDALONE === 'true') {
    // Use the configured server port for standalone mode
    const port = import.meta.env.VITE_SERVER_PORT
    return typeof port === 'string' ? parseInt(port, 10) : 8881
  }
  
  // Default to VS Code extension port
  return 25716
}

export function isStandaloneMode(): boolean {
  return import.meta.env.VITE_STANDALONE === true || import.meta.env.VITE_STANDALONE === 'true'
}

export const standaloneConfig = {
  serverPort: getServerPort(),
  isStandalone: isStandaloneMode(),
  // WebSocket configuration
  useWebSocket: true, // Enable WebSocket mode by default for standalone
  wsUrl: `ws://localhost:${getServerPort()}/ws`,
  wsReconnectDelay: 1000,
  wsMaxReconnectAttempts: 10,
  wsHeartbeatInterval: 30000,
}