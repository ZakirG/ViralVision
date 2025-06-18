import * as Comlink from 'comlink'
import type { WorkerAPI, Suggestion } from '@/workers/checkWorker'

let workerInstance: Worker | null = null
let api: Comlink.Remote<WorkerAPI> | null = null

// Initialize worker and wrap with Comlink
function initializeWorker(): Comlink.Remote<WorkerAPI> {
  if (typeof window === 'undefined') {
    // Server-side fallback - return mock API with proper signatures
    return {
      spell: async (word: string, lang: 'en_US'): Promise<Suggestion[]> => [],
      grammar: async (text: string): Promise<Suggestion[]> => []
    } as unknown as Comlink.Remote<WorkerAPI>
  }

  if (!workerInstance) {
    // Create worker from the checkWorker file
    workerInstance = new Worker(
      new URL('../workers/checkWorker.ts', import.meta.url),
      { type: 'module' }
    )
    
    // Wrap worker with Comlink
    api = Comlink.wrap<WorkerAPI>(workerInstance)
  }

  return api!
}

// Export the worker API
export const workerAPI = initializeWorker()

// Make workerAPI available globally for console testing (development only)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  ;(window as any).workerAPI = workerAPI
}

// Cleanup function for when the worker is no longer needed
export function terminateWorker(): void {
  if (workerInstance) {
    workerInstance.terminate()
    workerInstance = null
    api = null
  }
}

// Re-export types for convenience
export type { WorkerAPI, Suggestion, Path } from '@/workers/checkWorker' 