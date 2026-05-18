/**
 * Autofill Stats
 *
 * Tracks autofill usage count and last-used timestamp in chrome.storage.local.
 * Lightweight – reads/writes a single `autofillStats` key.
 */

const STORAGE_KEY = 'autofillStats'

function getStorage() {
  return globalThis.chrome?.storage?.local
}

function getLastError() {
  return globalThis.chrome?.runtime?.lastError
}

/**
 * Default stats shape.
 */
function defaultStats() {
  return {
    totalRuns: 0,
    totalFieldsFilled: 0,
    lastRunAt: null,
    lastResult: null, // 'success' | 'failure'
  }
}

/**
 * Read current stats from chrome.storage.local.
 * @returns {Promise<object>}
 */
export async function getAutofillStats() {
  const storage = getStorage()
  if (!storage) return defaultStats()

  return new Promise((resolve, reject) => {
    storage.get(STORAGE_KEY, (result) => {
      const error = getLastError()
      if (error) {
        reject(new Error(error.message))
        return
      }
      resolve({ ...defaultStats(), ...result[STORAGE_KEY] })
    })
  })
}

/**
 * Record the outcome of an autofill run.
 *
 * @param {{ success: boolean, filledCount: number }} outcome
 * @returns {Promise<object>} Updated stats
 */
export async function recordAutofillRun(outcome) {
  const stats = await getAutofillStats()

  stats.totalRuns += 1
  stats.totalFieldsFilled += outcome.filledCount || 0
  stats.lastRunAt = new Date().toISOString()
  stats.lastResult = outcome.success ? 'success' : 'failure'

  const storage = getStorage()
  if (!storage) return stats

  return new Promise((resolve, reject) => {
    storage.set({ [STORAGE_KEY]: stats }, () => {
      const error = getLastError()
      if (error) {
        reject(new Error(error.message))
        return
      }
      resolve(stats)
    })
  })
}
