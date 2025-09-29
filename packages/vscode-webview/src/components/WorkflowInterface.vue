<template>
  <div class="workflow-interface">
    <!-- Compact Modern Header -->
    <header class="workflow-header">
      <div class="header-left">
        <div class="brand-compact">
          <svg class="brand-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L4 7V17L12 22L20 17V7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
          </svg>
          <span class="brand-name">SuperCode</span>
        </div>
        <div class="nav-pills">
          <router-link to="/" class="nav-pill"> Simple </router-link>
          <router-link to="/workflow" class="nav-pill active"> Workflow <span class="alpha-badge">ALPHA</span> </router-link>
        </div>
      </div>
    </header>

    <!-- Model Selector Dropdown -->
    <ModelSelector
      :show="showModelSelector"
      :models="availableModels"
      :loading="loadingModels"
      :current-model="modelInfo"
      @close="hideModelSelector"
      @select="handleModelSelect"
    />

    <!-- Agent Selector Dropdown -->
    <AgentSelector
      :show="showAgentSelector"
      :agents="availableAgents"
      :loading="loadingAgents"
      :current-agent="agentInfo"
      @close="hideAgentSelector"
      @select="handleAgentSelect"
    />

    <!-- Output Style Selector Dropdown -->
    <OutputStyleSelector
      :show="showOutputStyleSelector"
      :styles="availableOutputStyles"
      :loading="loadingOutputStyles"
      :current-style="outputStyleInfo"
      @close="hideOutputStyleSelector"
      @select="handleOutputStyleSelect"
    />

    <!-- Modern Tab Navigation -->
    <nav class="workflow-tabs">
      <div class="tabs-container">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['tab-button', { active: activeTab === tab.id }]"
          @click="activeTab = tab.id"
        >
          {{ tab.name }}
        </button>
      </div>
    </nav>

    <!-- Main Content Area -->
    <main class="workflow-content">
      <!-- Modern Welcome Screen -->
      <div v-if="!taskActive && false" class="welcome-container">
        <div class="welcome-icon">
          <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
            <path
              d="M24 4L8 14V34L24 44L40 34V14L24 4Z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <h2 class="welcome-title">What can I help you build today?</h2>
        <p class="welcome-subtitle">Create new code, add features, or fix issues—let's make it happen.</p>

        <!-- Phase Cards -->
        <div class="phase-cards">
          <div class="phase-card" :class="{ selected: selectedPhase === 'phases' }" @click="selectPhase('phases')">
            <h3 class="phase-title">
              <svg class="phase-icon-inline" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15"
                  stroke="currentColor"
                  stroke-width="2"
                />
                <path
                  d="M9 5C9 6.65685 10.3431 8 12 8C13.6569 8 15 6.65685 15 5C15 3.34315 13.6569 2 12 2C10.3431 2 9 3.34315 9 5Z"
                  stroke="currentColor"
                  stroke-width="2"
                />
              </svg>
              Phases
            </h3>
            <p class="phase-description">
              Start with a conversation to clarify intent, then break the task into manageable phases.
            </p>
            <div v-if="selectedPhase === 'phases'" class="selection-indicator">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="9" fill="var(--accent-color)" />
                <path
                  d="M6 10L8.5 12.5L14 7"
                  stroke="white"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>

          <div class="phase-card" :class="{ selected: selectedPhase === 'plan' }" @click="selectPhase('plan')">
            <h3 class="phase-title">
              <svg class="phase-icon-inline" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z"
                  stroke="currentColor"
                  stroke-width="2"
                />
                <path d="M14 2V8H20" stroke="currentColor" stroke-width="2" />
              </svg>
              Plan
            </h3>
            <p class="phase-description">
              Get a detailed file-level plan, refine it with AI, and send it to the agent for execution.
            </p>
            <div v-if="selectedPhase === 'plan'" class="selection-indicator">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="9" fill="var(--accent-color)" />
                <path
                  d="M6 10L8.5 12.5L14 7"
                  stroke="white"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab Content (shown when task is active or in development mode) -->
      <div v-else-if="taskActive || true" class="tab-content">
        <keep-alive>
          <component
            :is="currentTabComponent"
            :task-data="currentTaskData"
            :model-info="modelInfo"
            :ws-client="sdkClient"
            :tab-type="activeTab"
            @update-task="updateTask"
            @regenerate-plan="regeneratePlan"
            @send-to-implementation="handleSendToImplementation"
            @send-to-plan="handleSendToPlan"
          />
        </keep-alive>
      </div>
    </main>

    <!-- Modern Input Area -->
    <FooterBar
      v-model="taskDescription"
      :placeholder="'Describe your task'"
      :disabled="isLoading"
      :connection-status="connectionStatus"
      :model-info="modelInfo"
      :agent-info="agentInfo"
      :port="currentPort"
      :output-style-info="outputStyleInfo"
      :hide-input="true"
      @submit="handleSubmit"
      @toggle-model-selector="toggleModelSelector"
      @toggle-agent-selector="toggleAgentSelector"
      @toggle-output-style-selector="toggleOutputStyleSelector"
      ref="footerBar"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue"
import PlanTab from "./tabs/PlanTab.vue"
import ImplementTab from "./tabs/ImplementTab.vue"
import PromptGenerationTab from "./tabs/PromptGenerationTab.vue"
import PlanGenerationTab from "./tabs/PlanGenerationTab.vue"
import ComingSoonTab from "./tabs/ComingSoonTab.vue"
import FooterBar from "./shared/FooterBar.vue"
import ModelSelector from "./shared/ModelSelector.vue"
import AgentSelector from "./shared/AgentSelector.vue"
import OutputStyleSelector from "./shared/OutputStyleSelector.vue"
import { ConnectionStatus, type ModelInfo, type TokenUsage, type SSEMessage } from "../types"
import { SuperCodeSDKClient } from "../services/SuperCodeSDKClient"
import { SuperCodeWebSocketClient } from "../services/SuperCodeWebSocketClient"
import { standaloneConfig } from "../config/standalone"

// Type definitions for task data
interface TaskData {
  messages?: Array<{
    id: string
    type: string
    content: string
    timestamp: number
  }>
  streamingUpdate?: string
  [key: string]: any
}

// Type definitions for models and agents
interface AvailableModel {
  id: string
  name: string
  provider: string
  capabilities: string[]
}

interface AvailableAgent {
  id: string
  name: string
  description?: string
  mode: string
  builtIn: boolean
  permission: {
    edit: string
    bash: Record<string, string> | string
    webfetch?: string
  }
  tools: Record<string, boolean>
}

// Tab configuration
const tabs = [
  { id: "prompt", name: "Prompt Generation", component: PromptGenerationTab },
  { id: "plan", name: "Plan", component: PlanGenerationTab }, // Updated to use PlanGenerationTab
  { id: "implement", name: "Implement", component: ComingSoonTab },
  { id: "review", name: "Review", component: ComingSoonTab },
  { id: "validate", name: "Validate", component: ComingSoonTab },
  { id: "enhance", name: "Enhance", component: ComingSoonTab },
  { id: "build", name: "Build", component: ComingSoonTab },
  { id: "deploy", name: "Deploy", component: ComingSoonTab },
  { id: "maintain", name: "Maintain", component: ComingSoonTab },
  { id: "daemon", name: "Daemon", component: ComingSoonTab },
]

// SDK Client instance
let sdkClient: SuperCodeSDKClient | SuperCodeWebSocketClient | null = null

// Port configuration
const currentPort = ref<number>(standaloneConfig.serverPort)

// Reactive state
const activeTab = ref("prompt")
const taskActive = ref(false)
const taskDescription = ref("")
const isLoading = ref(false)
const currentTaskData = ref<TaskData>({})
const connectionStatus = ref<ConnectionStatus>(ConnectionStatus.DISCONNECTED)
const modelInfo = ref<ModelInfo | null>(null)
const selectedPhase = ref<"phases" | "plan" | null>(null)
const agentInfo = ref<{ name: string; description?: string; id?: string } | null>(null)
const outputStyleInfo = ref<{ name: string; description?: string } | null>(null)
const tokenUsage = ref<TokenUsage | null>(null)
const showModelSelector = ref(false)
const showAgentSelector = ref(false)
const showOutputStyleSelector = ref(false)
const availableAgents = ref<AvailableAgent[]>([])
const availableModels = ref<AvailableModel[]>([])
const availableOutputStyles = ref<{ id: string; name: string; description: string }[]>([])
const formattedContextInfo = ref<string>("Context Unavailable")
const loadingModels = ref(false)
const selectingModel = ref<string | null>(null)
const loadingAgents = ref(false)
const selectingAgent = ref<string | null>(null)
const loadingOutputStyles = ref(false)
const selectingOutputStyle = ref<string | null>(null)

// Computed properties
const currentTabComponent = computed(() => {
  const tab = tabs.find((t) => t.id === activeTab.value)
  return tab?.component || PlanTab
})

const indicatorStyle = computed(() => {
  const index = tabs.findIndex((t) => t.id === activeTab.value)
  return {
    transform: `translateX(${index * 100}%)`,
  }
})

const isConnected = computed(() => connectionStatus.value === ConnectionStatus.CONNECTED)
const statusText = computed(() => {
  switch (connectionStatus.value) {
    case "connected":
      return "Connected"
    case "connecting":
      return "Connecting..."
    case "error":
      return "Error"
    default:
      return "Disconnected"
  }
})

// SDK Client initialization
async function initializeSDKClient() {
  console.log(`🔄 Starting SDK client initialization on port ${currentPort.value}`)
  connectionStatus.value = ConnectionStatus.CONNECTING

  // Initialize SDK client - use WebSocket if enabled in config
  if (standaloneConfig.useWebSocket) {
    console.log("🔌 Using WebSocket client for communication")
    sdkClient = new SuperCodeWebSocketClient({
      baseUrl: `http://localhost:${currentPort.value}`,
      port: currentPort.value,
      timeout: 5000,
      sessionId: undefined,
      directory: undefined,
    })
  } else {
    console.log("📡 Using HTTP client for communication")
    sdkClient = new SuperCodeSDKClient({
      baseUrl: `http://localhost:${currentPort.value}`,
      port: currentPort.value,
      timeout: 5000,
    })
  }

  // Implement polling mechanism with exponential backoff
  await pollForConnection()
}

async function pollForConnection() {
  const maxRetries = 10
  const baseDelay = 1000 // Start with 1 second
  const maxDelay = 10000 // Max 10 seconds between retries

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!sdkClient) {
        connectionStatus.value = ConnectionStatus.ERROR
        return
      }

      const isConnected = await sdkClient.testConnection()

      if (isConnected) {
        connectionStatus.value = ConnectionStatus.CONNECTED

        // Subscribe to SSE events
        await sdkClient.subscribeToEvents()

        // Set up message handlers
        sdkClient.onMessage(handleSSEMessage)
        sdkClient.onError(handleSSEError)

        // Fetch current model information, agent information, output style, and token usage
        await fetchModelInfo()
        await fetchAgentInfo()
        await fetchOutputStyleInfo()
        await fetchTokenUsage()

        return // Success - exit polling loop
      }
    } catch (error) {
      console.log(`❌ Connection attempt ${attempt} failed:`, error)
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)
    console.log(`⏳ Waiting ${delay}ms before retry...`)
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  // All retries exhausted
  connectionStatus.value = ConnectionStatus.ERROR
  console.error("❌ Failed to connect after all retries")
}

async function fetchModelInfo() {
  if (!sdkClient) {
    console.log("❌ No SDK client available for model fetching")
    return
  }

  try {
    const modelData = await sdkClient.getCurrentModel()

    // Update model info based on received data
    if (modelData && modelData.name) {
      modelInfo.value = {
        name: modelData.name,
        provider: modelData.provider || "",
        modelId: modelData.modelId || modelData.name,
        version: modelData.version || "",
      }
    } else {
      modelInfo.value = {
        name: "Unknown Model",
        provider: "",
        modelId: undefined,
        version: "",
      }
    }
  } catch (error) {
    console.error("❌ Failed to fetch model info:", error)
    modelInfo.value = {
      name: "Model Unavailable",
      provider: "",
      modelId: undefined,
      version: "",
    }
  }
}

async function fetchAgentInfo() {
  if (!sdkClient) {
    console.log("❌ No SDK client available for agent fetching")
    return
  }

  try {
    console.log("🔄 Calling getCurrentAgent() from component...")
    const agentData = await sdkClient.getCurrentAgent()
    console.log("📊 Agent data received in component:", agentData)

    // Update agent info based on received data
    if (agentData && agentData.name && agentData.name !== "Agent Unavailable") {
      agentInfo.value = {
        name: agentData.name,
        description: agentData.description || "",
        id: agentData.id || agentData.name || "default",
      }
      console.log("✅ Agent info updated successfully:", agentInfo.value)
    } else {
      agentInfo.value = {
        name: "Unknown Agent",
        description: "",
        id: "default",
      }
      console.log("⚠️ Using fallback agent info")
    }
  } catch (error) {
    console.error("❌ Failed to fetch agent info:", error)
    agentInfo.value = {
      name: "Agent Unavailable",
      description: "",
      id: "default",
    }
  }
}

async function fetchOutputStyleInfo() {
  if (!sdkClient) {
    console.log("❌ No SDK client available for output style fetching")
    return
  }

  try {
    console.log("🔄 Calling getCurrentOutputStyle() from component...")
    const styleData = await sdkClient.getCurrentOutputStyle()
    console.log("📊 Output style data received in component:", styleData)

    // Update output style info based on received data
    if (styleData && styleData.name) {
      outputStyleInfo.value = {
        name: styleData.name,
        description: styleData.description || "",
      }
      console.log("✅ Output style info updated in component:", outputStyleInfo.value)
    } else {
      console.log("⚠️ Invalid or unavailable output style data:", styleData)
      outputStyleInfo.value = {
        name: "default",
        description: "Concise and direct responses",
      }
    }
  } catch (error) {
    console.error("❌ Failed to fetch output style info:", error)
    outputStyleInfo.value = {
      name: "default",
      description: "Concise and direct responses",
    }
  }
}

async function fetchTokenUsage() {
  if (!sdkClient) {
    console.log("❌ No SDK client available for token usage fetching")
    formattedContextInfo.value = "Context Unavailable"
    return
  }

  try {
    const formattedUsage = await sdkClient.getFormattedTokenUsage()

    formattedContextInfo.value = formattedUsage

    // Also update raw token usage for compatibility
    const tokenData = await sdkClient.getTokenUsage()
    if (tokenData && tokenData.used !== -1 && tokenData.max !== -1 && tokenData.percentage !== -1) {
      tokenUsage.value = {
        used: tokenData.used,
        max: tokenData.max,
        percentage: tokenData.percentage,
      }
    } else {
      tokenUsage.value = { used: -1, max: -1, percentage: -1 }
    }
  } catch (error) {
    console.error("❌ Failed to fetch token usage info:", error)
    formattedContextInfo.value = "Context Unavailable"
    tokenUsage.value = { used: -1, max: -1, percentage: -1 }
  }
}

// SSE Event Handlers
function handleSSEMessage(message: SSEMessage) {
  console.log("📨 Received SSE message:", message)

  // Initialize messages array if not exists
  if (!currentTaskData.value.messages) {
    currentTaskData.value.messages = []
  }

  // Handle different message types
  switch (message.type) {
    case "message":
      if (message.content) {
        // Add new assistant message
        currentTaskData.value.messages.push({
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2)}`,
          type: "assistant",
          content: message.content,
          timestamp: Date.now(),
        })
        // Update task data to trigger reactivity
        currentTaskData.value = { ...currentTaskData.value }
      }
      break
    case "message.updated":
      // Process both assistant and user messages
      const messageRole = message.properties?.info?.role
      const messageId = message.properties?.info?.id
      let content = null

      // Extract content from the message
      if (message.properties?.info?.parts) {
        const parts = message.properties.info.parts
        const textParts = parts.filter((p: any) => p.type === "text")
        if (textParts.length > 0) {
          content = textParts.map((p: any) => p.text).join("")
        }
      } else if (message.properties?.info?.content) {
        content = message.properties.info.content
      } else if (message.properties?.info?.text) {
        content = message.properties.info.text
      } else if (message.properties?.content) {
        content = message.properties.content
      } else if (message.content) {
        content = message.content
      }

      if (content && messageId) {
        // Check if message already exists to prevent duplicates
        let targetMessage = currentTaskData.value.messages.find((msg) => msg.id === messageId)

        if (!targetMessage) {
          // Create new message
          const messageType = messageRole === "user" ? "user" : "assistant"
          targetMessage = {
            id: messageId,
            type: messageType,
            content: content,
            timestamp: Date.now(),
          }
          currentTaskData.value.messages.push(targetMessage)
        } else {
          // Update existing message
          targetMessage.content = content
        }

        // Trigger reactivity
        currentTaskData.value = { ...currentTaskData.value }
      }
      break
    case "message.part.updated":
      // Handle streaming message parts similar to SimpleInterface
      const part = message.properties?.part || message.part || message
      const partMessageId =
        part?.messageID ||
        part?.message_id ||
        message.messageID ||
        message.id ||
        `msg_${Date.now()}_${Math.random().toString(36).substring(2)}`

      console.log("📝 message.part.updated event:", { part, partMessageId, message })

      // Handle text parts with multiple possible content locations
      let partContent = null

      // Check various possible locations for the content
      if (part.text) {
        partContent = part.text
      } else if (part.content) {
        partContent = part.content
      } else if (part.data?.text) {
        partContent = part.data.text
      } else if (message.text) {
        partContent = message.text
      } else if (message.content) {
        partContent = message.content
      } else if (typeof part === "string") {
        partContent = part
      }

      console.log("📝 Extracted content:", partContent)

      if (partContent) {
        // Forward to PromptEnhancementService if on the prompt tab
        if (activeTab.value === "prompt") {
          // Emit an event that the PromptGenerationTab can listen to
          currentTaskData.value.streamingUpdate = {
            type: 'message.part.updated',
            content: partContent,
            timestamp: Date.now()
          }
        }

        // Forward to PlanGenerationService if on the plan tab
        if (activeTab.value === "plan") {
          // Emit an event that the PlanGenerationTab can listen to
          currentTaskData.value.streamingUpdate = {
            type: 'message.part.updated',
            content: partContent,
            timestamp: Date.now()
          }
        }

        // Find or create message for this ID
        let targetMessage = currentTaskData.value.messages.find((m) => m.id === partMessageId)

        if (!targetMessage) {
          // Create new assistant message
          targetMessage = {
            id: partMessageId,
            type: "assistant",
            content: partContent,
            timestamp: Date.now(),
          }
          currentTaskData.value.messages.push(targetMessage)
        } else {
          // Update existing message - the server sends complete accumulated text
          targetMessage.content = partContent
        }

        // Trigger reactivity
        currentTaskData.value = { ...currentTaskData.value }
      }
      break
    case "tui.model.changed":
      // Model changed - refresh model info
      console.log("🔄 Model changed event received, refreshing model info...")
      fetchModelInfo()
      break
    case "tui.agent.changed":
      // Agent changed - refresh agent info
      console.log("🔄 Agent changed event received, refreshing agent info...")
      fetchAgentInfo()
      break
    case "tui.output.style.changed":
      // Output style changed - refresh output style info
      console.log("🔄 Output style changed event received, refreshing output style info...")
      fetchOutputStyleInfo()
      break
    default:
      console.log("Unhandled SSE message type:", message.type)
  }
}

function handleSSEError(error: Error) {
  console.error("❌ SSE error:", error)
  connectionStatus.value = ConnectionStatus.ERROR

  // Add error message to the task data if active
  if (taskActive.value && currentTaskData.value.messages) {
    currentTaskData.value.messages.push({
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      type: "system",
      content: `Connection error: ${error.message}`,
      timestamp: Date.now(),
    })
  }
}

// Methods
const selectPhase = (phase: "phases" | "plan") => {
  selectedPhase.value = selectedPhase.value === phase ? null : phase

  // Optionally switch to the appropriate tab when selecting
  if (phase === "plan" && selectedPhase.value === "plan") {
    activeTab.value = "plan"
  }
}

const handleSubmit = async () => {
  if (!taskDescription.value.trim() || isLoading.value || !sdkClient) return

  isLoading.value = true
  taskActive.value = true

  // Store task data
  currentTaskData.value = {
    description: taskDescription.value,
    timestamp: new Date().toISOString(),
    status: "planning",
    selectedPhase: selectedPhase.value,
  }

  try {
    // Send /plan command to SuperCode
    const planCommand = `/plan ${taskDescription.value.trim()}`
    await sdkClient.sendMessage("default-session", planCommand)

    // The plan will be received through SSE events
    // Clear the task description after sending
    taskDescription.value = ""
  } catch (error) {
    console.error("Failed to send plan command:", error)
    // Show error to user
    taskActive.value = false
  } finally {
    isLoading.value = false
  }
}

const updateTask = (updates: any) => {
  currentTaskData.value = {
    ...currentTaskData.value,
    ...updates,
  }
}

const regeneratePlan = async () => {
  console.log("Regenerating plan...")
  // Implement plan regeneration logic
}

const handleSendToImplementation = (enhancedData: any) => {
  console.log("Sending enhanced prompt to implementation:", enhancedData)

  // Switch to the implement tab
  activeTab.value = "implement"

  // Update task data with enhanced prompt
  currentTaskData.value = {
    ...currentTaskData.value,
    enhancedPrompt: enhancedData.prompt,
    originalPrompt: enhancedData.originalPrompt,
    promptMetadata: enhancedData.metadata,
  }

  // Optionally auto-submit to implementation
  if (enhancedData.prompt) {
    taskDescription.value = enhancedData.prompt
    // Could trigger handleSubmit() here if desired
  }
}

const handleSendToPlan = (enhancedData: any) => {
  console.log("Sending enhanced prompt to plan:", enhancedData)

  // Switch to the plan tab
  activeTab.value = "plan"

  // Update task data with enhanced prompt
  currentTaskData.value = {
    ...currentTaskData.value,
    enhancedPrompt: enhancedData.prompt,
    originalPrompt: enhancedData.originalPrompt,
    promptMetadata: enhancedData.metadata,
  }

  // Optionally auto-submit to plan
  if (enhancedData.prompt) {
    taskDescription.value = enhancedData.prompt
    // Could trigger handleSubmit() here if desired
  }
}

// Hide methods
function hideModelSelector() {
  showModelSelector.value = false
  availableModels.value = []
  selectingModel.value = null
}

function hideAgentSelector() {
  showAgentSelector.value = false
  availableAgents.value = []
  selectingAgent.value = null
}

function hideOutputStyleSelector() {
  showOutputStyleSelector.value = false
  availableOutputStyles.value = []
  selectingOutputStyle.value = null
}

// Toggle methods
const toggleModelSelector = async () => {
  if (showModelSelector.value) {
    hideModelSelector()
    return
  }

  showModelSelector.value = true
  showAgentSelector.value = false
  loadingModels.value = true

  // Fetch available models
  if (sdkClient) {
    try {
      const providersData = (await sdkClient.getProviders()) as any
      console.log("Providers data:", providersData)
      if (providersData && providersData.providers) {
        const models: AvailableModel[] = []

        for (const provider of providersData.providers) {
          if (provider.models) {
            for (const [modelId, modelData] of Object.entries(provider.models)) {
              const model = modelData as any
              models.push({
                id: modelId,
                name: model.name || modelId,
                provider: provider.name || "Unknown",
                capabilities: model.capabilities || [],
              })
            }
          }
        }
        availableModels.value = models
      }
    } catch (error) {
      console.error("Failed to fetch available models:", error)
      availableModels.value = []
    } finally {
      loadingModels.value = false
    }
  } else {
    loadingModels.value = false
  }
}

const toggleAgentSelector = async () => {
  if (showAgentSelector.value) {
    hideAgentSelector()
    return
  }

  showAgentSelector.value = true
  showModelSelector.value = false
  loadingAgents.value = true

  // Fetch available agents
  if (sdkClient) {
    try {
      const agentsData = (await sdkClient.getAvailableAgents()) as any[]
      console.log("Agents data:", agentsData)
      if (agentsData && Array.isArray(agentsData)) {
        // Filter for primary and "all" mode agents only (exclude subagents)
        const selectableAgents = agentsData.filter((agent: any) => agent.mode === "primary" || agent.mode === "all")

        const agents: AvailableAgent[] = selectableAgents.map((agent: any) => ({
          id: agent.name,
          name: agent.name,
          description: agent.description || "No description available",
          mode: agent.mode,
          builtIn: agent.builtIn || false,
          permission: agent.permission || { edit: "unknown", bash: "unknown" },
          tools: agent.tools || {},
        }))
        availableAgents.value = agents
      }
    } catch (error) {
      console.error("Failed to fetch available agents:", error)
      availableAgents.value = []
    } finally {
      loadingAgents.value = false
    }
  } else {
    loadingAgents.value = false
  }
}

const toggleOutputStyleSelector = async () => {
  if (showOutputStyleSelector.value) {
    hideOutputStyleSelector()
    return
  }

  showOutputStyleSelector.value = true
  showModelSelector.value = false
  showAgentSelector.value = false
  loadingOutputStyles.value = true

  // Fetch available output styles
  if (sdkClient) {
    try {
      const stylesData = await sdkClient.getAvailableOutputStyles()
      console.log("Output styles data:", stylesData)
      if (stylesData && Array.isArray(stylesData)) {
        availableOutputStyles.value = stylesData
      }
    } catch (error) {
      console.error("Failed to fetch available output styles:", error)
      availableOutputStyles.value = [
        {
          id: "default",
          name: "Default",
          description: "Concise and direct responses",
        },
      ]
    } finally {
      loadingOutputStyles.value = false
    }
  } else {
    loadingOutputStyles.value = false
  }
}

// Selection methods
async function selectModel(providerId: string, modelId: string, modelName: string) {
  if (!sdkClient) {
    console.error("No SDK client available for setting model")
    return
  }

  const selectionKey = `${providerId}-${modelId}`
  selectingModel.value = selectionKey

  try {
    await sdkClient.setModel(providerId, modelId)

    // Update local model info immediately for better UX
    modelInfo.value = {
      name: modelName,
      provider: providerId,
      modelId: modelId,
      version: "",
    }

    // Hide the selector
    hideModelSelector()
  } catch (error) {
    console.error("Failed to set model:", error)
  } finally {
    selectingModel.value = null
  }
}

async function selectAgent(agentId: string, agentName: string) {
  if (!sdkClient) {
    console.error("No SDK client available for setting agent")
    return
  }

  selectingAgent.value = agentId

  try {
    await sdkClient.setAgent(agentId)

    // Update local agent info
    agentInfo.value = {
      name: agentName,
      id: agentId,
    }

    // Hide the selector
    hideAgentSelector()
  } catch (error) {
    console.error("Failed to set agent:", error)
  } finally {
    selectingAgent.value = null
  }
}

async function selectOutputStyle(styleId: string, styleName: string, styleDescription: string) {
  if (!sdkClient) {
    console.error("No SDK client available for setting output style")
    return
  }

  selectingOutputStyle.value = styleId

  try {
    await sdkClient.setOutputStyle(styleId)

    // Update local output style info
    outputStyleInfo.value = {
      name: styleName,
      description: styleDescription,
    }

    // Hide the selector
    hideOutputStyleSelector()
  } catch (error) {
    console.error("Failed to set output style:", error)
  } finally {
    selectingOutputStyle.value = null
  }
}

// Handler methods for shared components
function handleModelSelect(model: any) {
  selectModel(model.provider, model.id, model.name)
}

function handleAgentSelect(agent: any) {
  selectAgent(agent.id, agent.name)
}

function handleOutputStyleSelect(style: any) {
  selectOutputStyle(style.id, style.name, style.description)
}

// Lifecycle
onMounted(async () => {
  // Initialize SDK client
  await initializeSDKClient()

  // Focus task input
  nextTick(() => {
    const input = document.querySelector(".task-input") as HTMLTextAreaElement
    input?.focus()
  })
})

onUnmounted(() => {
  // Cleanup SDK client
  if (sdkClient) {
    sdkClient.unsubscribeFromEvents()
    // If it's a WebSocket client, disconnect properly
    if (sdkClient instanceof SuperCodeWebSocketClient) {
      sdkClient.disconnect()
    }
    sdkClient = null
  }
})
</script>

<style scoped>
.workflow-interface {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary, #0a0a0a);
  color: var(--text-primary, #e0e0e0);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

/* Modern Compact Header */
.workflow-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.375rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.brand-compact {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.brand-icon {
  color: var(--accent-color, #0066ff);
  width: 18px;
  height: 18px;
}

.brand-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
  letter-spacing: -0.01em;
}

.nav-pills {
  display: flex;
  gap: 2px;
  padding: 2px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.375rem;
}

.nav-pill {
  padding: 0.25rem 0.625rem;
  color: var(--text-secondary, #999);
  text-decoration: none;
  border-radius: 0.25rem;
  font-size: 0.8125rem;
  font-weight: 500;
  transition: all 0.15s ease;
  background: transparent;
  border: none;
  cursor: pointer;
}

.nav-pill:hover {
  color: var(--text-primary, #e0e0e0);
  background: rgba(255, 255, 255, 0.05);
}

.nav-pill.active {
  color: white;
  background: var(--accent-color, #0066ff);
}

/* Alpha badge styling */
.alpha-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  height: 16px;
  margin-left: 6px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  background: linear-gradient(135deg, #ff6b35, #ff8c42);
  color: white;
  border-radius: 3px;
  vertical-align: middle;
  letter-spacing: 0.5px;
  box-shadow: 0 1px 3px rgba(255, 107, 53, 0.3);
  animation: pulse-glow 2s infinite;
  position: relative;
  top: -1px;
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 1px 3px rgba(255, 107, 53, 0.3);
  }
  50% {
    box-shadow: 0 1px 6px rgba(255, 107, 53, 0.5), 0 0 10px rgba(255, 107, 53, 0.2);
  }
}

.nav-pill.active .alpha-badge {
  background: linear-gradient(135deg, #ff4500, #ff6347);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  animation: none;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-info {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-secondary, #999);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #666;
}

.status-text {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.model-btn,
.agent-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.25rem;
  color: var(--text-secondary, #999);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.model-btn:hover,
.agent-btn:hover {
  border-color: rgba(0, 102, 255, 0.5);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary, #e0e0e0);
}

.btn-label {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
}

/* Dropdown Styles */
.dropdown-menu {
  position: absolute;
  top: 3rem;
  right: 0.75rem;
  z-index: 1000;
}

.dropdown-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: transparent;
}

.dropdown-content {
  background: rgba(30, 30, 30, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  overflow: hidden;
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  min-width: 200px;
}

.dropdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.625rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.8125rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary, #999);
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
  transition: all 0.15s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary, #e0e0e0);
}

.dropdown-list {
  padding: 0.375rem;
  max-height: 300px;
  overflow-y: auto;
}

.dropdown-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.5rem 0.625rem;
  background: transparent;
  border: none;
  color: var(--text-secondary, #999);
  font-size: 0.8125rem;
  cursor: pointer;
  border-radius: 0.25rem;
  transition: all 0.15s ease;
}

.dropdown-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary, #e0e0e0);
}

.dropdown-item.active {
  background: rgba(0, 102, 255, 0.1);
  color: var(--accent-color, #0066ff);
}

.item-name {
  font-weight: 500;
  margin-bottom: 0.125rem;
}

.item-description {
  font-size: 0.7rem;
  color: var(--text-secondary, #999);
  opacity: 0.8;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  color: var(--text-secondary, #999);
  cursor: pointer;
  border-radius: 0.25rem;
  transition: all 0.15s ease;
}

.icon-btn:hover {
  color: var(--text-primary, #e0e0e0);
  background: rgba(255, 255, 255, 0.05);
}

/* Modern Tab Navigation */
.workflow-tabs {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(0, 0, 0, 0.2);
}

.tabs-container {
  display: flex;
  padding: 0 0.75rem;
  gap: 0.5rem;
}

.tab-button {
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary, #999);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
}

.tab-button:hover {
  color: var(--text-primary, #e0e0e0);
}

.tab-button.active {
  color: var(--text-primary, #e0e0e0);
  border-bottom-color: var(--accent-color, #0066ff);
}

/* Main Content */
.workflow-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.6));
}

.welcome-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  text-align: center;
}

.welcome-icon {
  color: var(--accent-color, #0066ff);
  margin-bottom: 1rem;
  opacity: 0.9;
}

.welcome-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.375rem;
  background: linear-gradient(135deg, #ffffff, #999999);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.welcome-subtitle {
  color: var(--text-secondary, #999);
  margin: 0 0 1.5rem;
  font-size: 0.8125rem;
  opacity: 0.8;
}

/* Phase Cards */
.phase-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  max-width: 600px;
  width: 100%;
}

.phase-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
  padding: 0.875rem;
  text-align: left;
  transition: all 0.15s ease;
  cursor: pointer;
  backdrop-filter: blur(10px);
  position: relative;
}

.phase-card:hover {
  border-color: rgba(0, 102, 255, 0.3);
  background: rgba(0, 102, 255, 0.03);
  transform: translateY(-1px);
}

.phase-card.selected {
  border-color: var(--accent-color, #0066ff);
  background: rgba(0, 102, 255, 0.12);
  box-shadow: 0 0 0 1px var(--accent-color, #0066ff) inset;
}

.selection-indicator {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.phase-title {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.9375rem;
  font-weight: 600;
  margin: 0 0 0.25rem;
}

.phase-icon-inline {
  color: var(--accent-color, #0066ff);
  opacity: 0.8;
  flex-shrink: 0;
}

.phase-description {
  color: var(--text-secondary, #999);
  font-size: 0.75rem;
  line-height: 1.4;
  margin: 0;
  opacity: 0.8;
}

/* Modern Footer */
.workflow-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(10px);
}

.input-wrapper {
  position: relative;
  margin-bottom: 0.5rem;
}

.task-input {
  width: 100%;
  min-height: 48px;
  padding: 0.5rem;
  padding-right: 3rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.375rem;
  color: var(--text-primary, #e0e0e0);
  font-family: inherit;
  font-size: 0.8125rem;
  resize: vertical;
  transition: all 0.15s ease;
}

.task-input:focus {
  outline: none;
  border-color: rgba(0, 102, 255, 0.5);
  background: rgba(255, 255, 255, 0.05);
}

.input-actions {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--accent-color, #0066ff);
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.submit-btn:hover:not(:disabled) {
  background: var(--accent-hover, #0052cc);
  transform: scale(1.05);
}

.submit-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.footer-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.model-btn-footer,
.agent-btn-footer {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.25rem;
  color: var(--text-secondary, #999);
  font-size: 0.7rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.model-btn-footer:hover,
.agent-btn-footer:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.15);
  color: var(--text-primary, #e0e0e0);
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--text-secondary, #999);
  padding: 0.25rem 0.5rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 0.25rem;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #00ff88;
  animation: pulse 2s ease-in-out infinite;
}

.status-dot.connected {
  background: #00ff88;
}

.status-dot.connecting {
  background: #ffaa00;
}

.status-dot.disconnected {
  background: #ff4444;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Model/Agent Selector Dropdowns */
.model-selector-dropdown,
.agent-selector-dropdown {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 80px;
}

.model-selector-overlay,
.agent-selector-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
}

.model-selector-content,
.agent-selector-content {
  position: relative;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 6px;
  min-width: 320px;
  max-width: 500px;
  max-height: 60vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.model-selector-header,
.agent-selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #333;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  color: #999;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: all 0.15s ease;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.model-selector-body,
.agent-selector-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.loading-models,
.loading-agents,
.no-models,
.no-agents {
  padding: 24px;
  text-align: center;
  color: #666;
}

.model-list,
.agent-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.model-item,
.agent-item {
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.model-item:hover,
.agent-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: #333;
}

.model-item.selected,
.agent-item.selected {
  background: rgba(0, 102, 255, 0.1);
  border-color: #0066ff;
}

.model-item.selecting,
.agent-item.selecting {
  opacity: 0.6;
  pointer-events: none;
}

.model-name,
.agent-name {
  font-weight: 500;
  margin-bottom: 4px;
}

.model-provider {
  font-size: 0.75rem;
  color: #666;
}

.agent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.agent-badges {
  display: flex;
  gap: 6px;
}

.agent-mode-badge,
.built-in-badge {
  padding: 2px 6px;
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 3px;
  font-weight: 500;
}

.agent-mode-badge.custom {
  background: rgba(0, 102, 255, 0.15);
  color: #4da6ff;
}

.agent-mode-badge.built-in {
  background: rgba(0, 255, 136, 0.15);
  color: #00ff88;
}

.built-in-badge {
  background: rgba(255, 153, 0, 0.15);
  color: #ff9900;
}

.agent-description {
  font-size: 0.75rem;
  color: #999;
  margin-bottom: 8px;
  line-height: 1.4;
}

.agent-permissions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.permission-group {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.625rem;
}

.permission-label {
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.permission-value {
  padding: 2px 5px;
  border-radius: 3px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.permission-value.allow {
  background: rgba(0, 255, 136, 0.15);
  color: #00ff88;
}

.permission-value.deny {
  background: rgba(255, 68, 68, 0.15);
  color: #ff4444;
}

.permission-value.custom {
  background: rgba(255, 153, 0, 0.15);
  color: #ff9900;
}

/* Dark theme variables */
:root {
  --bg-primary: #0a0a0a;
  --bg-secondary: #1a1a1a;
  --text-primary: #e0e0e0;
  --text-secondary: #999;
  --border-color: #2a2a2a;
  --accent-color: #0066ff;
  --accent-hover: #0052cc;
}
</style>
