/**
 * Application History Storage
 *
 * CRUD operations for job application records in chrome.storage.local.
 * Each record tracks a single job application with company, role, URL, and timestamp.
 *
 * Storage key: `applicationHistory` → Array<ApplicationRecord>
 */

const STORAGE_KEY = 'applicationHistory'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStorage() {
  return globalThis.chrome?.storage?.local
}

function getLastError() {
  return globalThis.chrome?.runtime?.lastError
}

/**
 * Generate a unique ID using timestamp + random suffix.
 * Avoids external dependencies while staying collision-resistant.
 */
function generateId() {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  return `${timestamp}-${random}`
}

/**
 * Read the raw history array from storage.
 * @returns {Promise<Array>}
 */
function readHistory() {
  const storage = getStorage()
  if (!storage) return Promise.resolve([])

  return new Promise((resolve, reject) => {
    storage.get(STORAGE_KEY, (result) => {
      const error = getLastError()
      if (error) {
        reject(new Error(error.message))
        return
      }
      resolve(Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [])
    })
  })
}

/**
 * Persist the history array to storage.
 * @param {Array} history
 * @returns {Promise<void>}
 */
function writeHistory(history) {
  const storage = getStorage()
  if (!storage) throw new Error('chrome.storage.local is unavailable')

  return new Promise((resolve, reject) => {
    storage.set({ [STORAGE_KEY]: history }, () => {
      const error = getLastError()
      if (error) {
        reject(new Error(error.message))
        return
      }
      resolve()
    })
  })
}

// ---------------------------------------------------------------------------
// Record shape
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ApplicationRecord
 * @property {string} id          - Unique identifier
 * @property {string} company     - Company name
 * @property {string} role        - Role / job title
 * @property {string} url         - Application page URL
 * @property {string} appliedAt   - ISO 8601 timestamp of when the application was recorded
 */

/**
 * Create a normalised record from partial input.
 * Fills in `id` and `appliedAt` if missing.
 *
 * @param {Partial<ApplicationRecord>} data
 * @returns {ApplicationRecord}
 */
/**
 * Check whether a value is a non-null object (not an array).
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Validate that a record has the minimum required shape (an id and at least
 * one meaningful field).  Malformed entries are filtered out on read.
 */
function isValidRecord(record) {
  if (!isPlainObject(record)) return false
  if (typeof record.id !== 'string' || record.id.length === 0) return false
  return true
}

function normalizeRecord(data = {}) {
  const appliedAt = data.appliedAt && !isNaN(Date.parse(data.appliedAt))
    ? data.appliedAt
    : new Date().toISOString()

  return {
    id: typeof data.id === 'string' && data.id.length > 0 ? data.id : generateId(),
    company: (typeof data.company === 'string' ? data.company : '').trim(),
    role: (typeof data.role === 'string' ? data.role : '').trim(),
    url: (typeof data.url === 'string' ? data.url : '').trim(),
    appliedAt,
  }
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

/** Time window (ms) within which the same URL is considered a duplicate. */
const DUPLICATE_WINDOW_MS = 60_000 // 1 minute

/**
 * Check whether a record with the same URL was already saved recently.
 *
 * @param {Array} history - Existing history array
 * @param {string} url    - URL to check
 * @returns {boolean}
 */
function isDuplicate(history, url) {
  if (!url) return false

  const normalizedUrl = url.trim().toLowerCase()
  const cutoff = Date.now() - DUPLICATE_WINDOW_MS

  return history.some((record) => {
    const recordUrl = typeof record.url === 'string' ? record.url.trim().toLowerCase() : ''
    if (recordUrl !== normalizedUrl) return false
    const recordTime = Date.parse(record.appliedAt)
    return !isNaN(recordTime) && recordTime >= cutoff
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the full application history, most-recent first.
 *
 * @returns {Promise<ApplicationRecord[]>}
 */
export async function getApplicationHistory() {
  const raw = await readHistory()

  // Filter out malformed entries, normalise the rest
  const history = raw
    .filter(isValidRecord)
    .map(normalizeRecord)

  // Sort descending by appliedAt so newest entries appear first
  return history.sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))
}

/**
 * Add a new application record.
 *
 * @param {{ company: string, role: string, url: string }} data
 * @returns {Promise<ApplicationRecord>} The created record (with generated id & timestamp)
 */
export async function addApplicationRecord(data) {
  const record = normalizeRecord(data)
  const history = await readHistory()

  // Prevent duplicate entries for the same URL within a short timeframe
  if (isDuplicate(history, record.url)) {
    console.log('ApplyFlow: Skipping duplicate application record', { url: record.url })
    return null
  }

  history.push(record)
  await writeHistory(history)

  console.log('ApplyFlow: Saved application record', record)
  return record
}

/**
 * Delete an application record by id.
 *
 * @param {string} id - Record identifier to remove
 * @returns {Promise<boolean>} `true` if a record was removed, `false` if not found
 */
export async function deleteApplicationRecord(id) {
  const history = await readHistory()
  const index = history.findIndex((record) => record.id === id)

  if (index === -1) return false

  history.splice(index, 1)
  await writeHistory(history)

  return true
}
