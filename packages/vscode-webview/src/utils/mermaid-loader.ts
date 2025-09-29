/**
 * Mermaid loader utility for dynamic loading in Vite environment
 * This ensures proper loading of Mermaid regardless of the environment
 */

declare global {
  interface Window {
    mermaid: any
    mermaidAPI: any
  }
}

let mermaidPromise: Promise<any> | null = null

export async function loadMermaid(): Promise<any> {
  // Return cached promise if already loading
  if (mermaidPromise) {
    return mermaidPromise
  }

  // Check if already loaded
  if (window.mermaid) {
    console.log('[MermaidLoader] Mermaid already loaded')
    return window.mermaid
  }

  mermaidPromise = loadMermaidInternal()
  return mermaidPromise
}

async function loadMermaidInternal(): Promise<any> {
  console.log('[MermaidLoader] Loading Mermaid via script injection...')

  return new Promise((resolve, reject) => {
    // Check if script already exists
    const existing = document.querySelector('script[data-mermaid-loader="true"]')
    if (existing) {
      // Wait for it to load
      setTimeout(() => {
        if (window.mermaid) {
          resolve(window.mermaid)
        } else {
          reject(new Error('Mermaid script exists but not loaded'))
        }
      }, 1000)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js'
    script.async = true
    script.setAttribute('data-mermaid-loader', 'true')

    let loadTimeout: NodeJS.Timeout

    // Set up load handler
    script.onload = () => {
      console.log('[MermaidLoader] Script tag loaded')

      // Clear timeout
      clearTimeout(loadTimeout)

      // Mermaid might not be immediately available
      let attempts = 0
      const checkMermaid = () => {
        attempts++
        if (window.mermaid) {
          console.log('[MermaidLoader] Mermaid object available')

          // Initialize Mermaid
          try {
            window.mermaid.initialize({
              startOnLoad: false,
              theme: 'dark',
              themeVariables: {
                primaryColor: '#8b5cf6',
                primaryTextColor: '#fff',
                primaryBorderColor: '#7c3aed',
                lineColor: '#a78bfa',
                secondaryColor: '#6d28d9',
                tertiaryColor: '#4c1d95',
                background: '#1f2937',
                mainBkg: '#1f2937',
                secondBkg: '#111827',
                tertiaryBkg: '#0f172a',
                textColor: '#f3f4f6',
                fontSize: '14px'
              },
              securityLevel: 'loose',
              logLevel: 'error'
            })

            console.log('[MermaidLoader] Mermaid initialized successfully')
            resolve(window.mermaid)
          } catch (initError) {
            console.error('[MermaidLoader] Failed to initialize Mermaid:', initError)
            reject(initError)
          }
        } else if (attempts < 20) {
          // Try again in 100ms
          setTimeout(checkMermaid, 100)
        } else {
          reject(new Error('Mermaid not available after script load'))
        }
      }

      // Start checking
      checkMermaid()
    }

    script.onerror = (error) => {
      clearTimeout(loadTimeout)
      console.error('[MermaidLoader] Script loading failed', error)

      // Try alternative CDN
      console.log('[MermaidLoader] Trying fallback CDN...')
      script.src = 'https://unpkg.com/mermaid@10/dist/mermaid.min.js'

      // Try one more time with fallback
      script.onerror = (error2) => {
        reject(new Error('Failed to load Mermaid from all CDNs'))
      }

      document.head.appendChild(script)
    }

    // Set timeout for loading
    loadTimeout = setTimeout(() => {
      reject(new Error('Mermaid loading timed out'))
    }, 10000)

    // Append to head
    document.head.appendChild(script)
  })
}

/**
 * Sanitize mermaid diagram syntax to fix common issues
 * @param diagram The raw mermaid diagram definition
 * @returns The sanitized diagram definition
 */
export function sanitizeMermaidDiagram(diagram: string): string {
  console.log('[MermaidLoader] Sanitizing diagram...')

  // Split by lines to process each line
  const lines = diagram.split('\n')
  const sanitizedLines = lines.map(line => {
    // Skip empty lines or directive lines
    if (!line.trim() || line.trim().startsWith('%%') || line.trim().startsWith('graph') ||
        line.trim().startsWith('flowchart') || line.trim().startsWith('sequenceDiagram') ||
        line.trim().startsWith('classDiagram') || line.trim().startsWith('stateDiagram') ||
        line.trim().startsWith('erDiagram') || line.trim().startsWith('gantt') ||
        line.trim().startsWith('pie') || line.trim().startsWith('gitGraph')) {
      return line
    }

    // Pattern 1: Fix node definitions with labels containing special characters
    // Matches patterns like: NodeID[label text] or NodeID(label text) or NodeID{label text}
    line = line.replace(/(\w+)([\[\(\{])([^\]\)\}]*)([\]\)\}])/g, (match, nodeId, openBracket, labelContent, closeBracket) => {
      // Check if label content needs quotes
      const specialChars = ['/', '\\', '|', '[', ']', '(', ')', '{', '}', '<', '>', '&', '#', '@', '!', '?', '*', '+', '=', '^', '$', '%', '~', '`']
      const needsQuotes = specialChars.some(char => labelContent.includes(char))

      // If the label already starts and ends with quotes, don't add more
      if (labelContent.trim().startsWith('"') && labelContent.trim().endsWith('"')) {
        return match
      }

      // If the label already starts and ends with single quotes, convert to double quotes
      if (labelContent.trim().startsWith("'") && labelContent.trim().endsWith("'")) {
        const unquoted = labelContent.trim().slice(1, -1)
        return `${nodeId}${openBracket}"${unquoted}"${closeBracket}`
      }

      // If label contains special characters and isn't quoted, add quotes
      if (needsQuotes) {
        // Escape any existing quotes in the label
        const escapedLabel = labelContent.replace(/"/g, '\\"')
        return `${nodeId}${openBracket}"${escapedLabel}"${closeBracket}`
      }

      return match
    })

    // Pattern 2: Fix edge labels with special characters
    // Matches patterns like: --> |label text| or -- label text -->
    line = line.replace(/(--[->]*)\s*\|([^|]*)\|/g, (match, arrow, labelContent) => {
      const specialChars = ['/', '\\', '[', ']', '(', ')', '{', '}', '<', '>', '&', '#', '@', '!', '?', '*', '+', '=', '^', '$', '%', '~', '`']
      const needsQuotes = specialChars.some(char => labelContent.includes(char))

      // Check if already quoted
      if (labelContent.trim().startsWith('"') && labelContent.trim().endsWith('"')) {
        return match
      }

      if (needsQuotes) {
        const escapedLabel = labelContent.replace(/"/g, '\\"')
        return `${arrow} |"${escapedLabel}"|`
      }

      return match
    })

    // Pattern 3: Fix node IDs with spaces (replace with underscores)
    // This is a bit tricky as we need to be careful not to break valid syntax
    // For now, we'll focus on the most common patterns already handled above

    return line
  })

  const sanitized = sanitizedLines.join('\n')
  console.log('[MermaidLoader] Sanitization complete')
  return sanitized
}

export async function renderMermaidDiagram(element: HTMLElement, graphDefinition: string): Promise<void> {
  try {
    const mermaid = await loadMermaid()

    if (!mermaid) {
      throw new Error('Mermaid not available')
    }

    // Sanitize the diagram before rendering
    const sanitizedDefinition = sanitizeMermaidDiagram(graphDefinition)
    console.log('[MermaidLoader] Original diagram:', graphDefinition)
    console.log('[MermaidLoader] Sanitized diagram:', sanitizedDefinition)

    const uniqueId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Clear the element first
    element.innerHTML = ''
    element.removeAttribute('data-processed')

    // Try the render API first (v10+)
    if (mermaid.render) {
      try {
        console.log(`[MermaidLoader] Rendering diagram ${uniqueId}`)
        const result = await mermaid.render(uniqueId, sanitizedDefinition)
        const svg = typeof result === 'string' ? result : result.svg
        element.innerHTML = svg
        element.classList.add('mermaid-rendered')
        console.log(`[MermaidLoader] Successfully rendered diagram ${uniqueId}`)
      } catch (renderError: any) {
        console.warn('[MermaidLoader] Render API failed, trying mermaidAPI...', renderError)

        // Try mermaidAPI
        if (mermaid.mermaidAPI && mermaid.mermaidAPI.render) {
          try {
            mermaid.mermaidAPI.render(uniqueId, sanitizedDefinition, (svgCode: string) => {
              element.innerHTML = svgCode
              element.classList.add('mermaid-rendered')
              console.log(`[MermaidLoader] Rendered via mermaidAPI ${uniqueId}`)
            })
          } catch (apiError) {
            throw apiError
          }
        } else {
          // Last resort - use init
          console.log('[MermaidLoader] Trying init method...')
          element.textContent = sanitizedDefinition
          element.className = 'mermaid'
          element.removeAttribute('data-processed')
          await mermaid.init(undefined, element)
          element.classList.add('mermaid-rendered')
          console.log(`[MermaidLoader] Initialized diagram ${uniqueId}`)
        }
      }
    } else {
      // Fallback for older versions
      console.log('[MermaidLoader] Using init method (no render API)...')
      element.textContent = sanitizedDefinition
      element.className = 'mermaid'
      await mermaid.init(undefined, element)
      element.classList.add('mermaid-rendered')
    }
  } catch (error) {
    console.error(`[MermaidLoader] Error rendering diagram:`, error)
    throw error
  }
}