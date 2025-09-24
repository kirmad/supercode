import { ref, onUnmounted } from 'vue'
import { supercodeWorkflow } from '../services/SuperCodeWorkflow'
import type {
  PlanStep,
  AnalysisResponse,
  ImplementationProgress,
  FileChange
} from '../services/SuperCodeWorkflow'

/**
 * Vue composable for interacting with SuperCode workflow
 */
export function useSuperCodeWorkflow() {
  // State
  const isConnected = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Plan state
  const currentPlan = ref<PlanStep[]>([])
  const planAnalysis = ref<AnalysisResponse | null>(null)

  // Implementation state
  const implementationStatus = ref<'idle' | 'running' | 'paused' | 'completed' | 'error'>('idle')
  const implementationProgress = ref(0)
  const implementationMessages = ref<any[]>([])

  // Review state
  const fileChanges = ref<FileChange[]>([])
  const changesSummary = ref({
    totalFiles: 0,
    totalAdditions: 0,
    totalDeletions: 0
  })

  // Cleanup functions
  const cleanupFunctions: Array<() => void> = []

  /**
   * Plan Phase Functions
   */
  const createPlan = async (taskDescription: string) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await supercodeWorkflow.createPlan(taskDescription)
      if (response.success) {
        currentPlan.value = response.plan.steps
      }
      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create plan'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const analyzeTask = async (taskDescription: string) => {
    isLoading.value = true
    error.value = null

    try {
      const analysis = await supercodeWorkflow.analyzeTask(taskDescription)
      planAnalysis.value = analysis
      return analysis
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to analyze task'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Implementation Phase Functions
   */
  const startImplementation = async (planId?: string) => {
    if (!planId && currentPlan.value.length === 0) {
      error.value = 'No plan available to implement'
      return
    }

    isLoading.value = true
    error.value = null

    try {
      await supercodeWorkflow.startImplementation(planId || 'current')
      implementationStatus.value = 'running'

      // Set up progress listener
      const unsubscribe = supercodeWorkflow.onImplementationProgress((progress) => {
        implementationStatus.value = progress.status
        implementationProgress.value = progress.progress
        if (progress.messages.length > 0) {
          implementationMessages.value.push(...progress.messages)
        }
      })

      cleanupFunctions.push(unsubscribe)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to start implementation'
      implementationStatus.value = 'error'
    } finally {
      isLoading.value = false
    }
  }

  const pauseImplementation = async () => {
    try {
      await supercodeWorkflow.pauseImplementation()
      implementationStatus.value = 'paused'
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to pause implementation'
    }
  }

  const resumeImplementation = async () => {
    try {
      await supercodeWorkflow.resumeImplementation()
      implementationStatus.value = 'running'
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to resume implementation'
    }
  }

  const stopImplementation = async () => {
    try {
      await supercodeWorkflow.stopImplementation()
      implementationStatus.value = 'idle'
      implementationProgress.value = 0
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to stop implementation'
    }
  }

  /**
   * Review Phase Functions
   */
  const loadChanges = async (implementationId?: string) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await supercodeWorkflow.getChanges(implementationId || 'current')
      fileChanges.value = response.files
      changesSummary.value = response.summary
      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load changes'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const applyChanges = async (changeIds: string[]) => {
    isLoading.value = true
    error.value = null

    try {
      await supercodeWorkflow.applyChanges(changeIds)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to apply changes'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const requestChanges = async (feedback: string) => {
    isLoading.value = true
    error.value = null

    try {
      await supercodeWorkflow.requestChanges(feedback)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to request changes'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Connection Management
   */
  const checkConnection = () => {
    isConnected.value = supercodeWorkflow.isConnectedToSuperCode()
    return isConnected.value
  }

  const reconnect = async () => {
    isLoading.value = true
    error.value = null

    try {
      await supercodeWorkflow.reconnect()
      isConnected.value = true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to reconnect'
      isConnected.value = false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Cleanup on component unmount
   */
  onUnmounted(() => {
    cleanupFunctions.forEach(cleanup => cleanup())
    cleanupFunctions.length = 0
  })

  return {
    // State
    isConnected,
    isLoading,
    error,

    // Plan state
    currentPlan,
    planAnalysis,

    // Implementation state
    implementationStatus,
    implementationProgress,
    implementationMessages,

    // Review state
    fileChanges,
    changesSummary,

    // Plan functions
    createPlan,
    analyzeTask,

    // Implementation functions
    startImplementation,
    pauseImplementation,
    resumeImplementation,
    stopImplementation,

    // Review functions
    loadChanges,
    applyChanges,
    requestChanges,

    // Connection functions
    checkConnection,
    reconnect
  }
}