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

  // Maintain backward compatibility: if no explicit `status` is provided,
  // treat legacy records as `applied` (they were created as applied historically).
  const status = typeof data.status === 'string' ? data.status : 'applied'

  return {
    id: typeof data.id === 'string' && data.id.length > 0 ? data.id : generateId(),
    company: (typeof data.company === 'string' ? data.company : '').trim(),
    role: (typeof data.role === 'string' ? data.role : '').trim(),
    url: (typeof data.url === 'string' ? data.url : '').trim(),
    appliedAt,
    status,
  }
}

function getRecordKey(record) {
  const company = (record.company || '').trim().toLowerCase()
  const role = (record.role || '').trim().toLowerCase()
  const url = (record.url || '').trim().toLowerCase()
  return `${company}||${role}||${url}`
}

function chooseBestRecord(first, second) {
  if (first.status === second.status) {
    return first.appliedAt >= second.appliedAt ? first : second
  }

  if (first.status === 'applied') return first
  if (second.status === 'applied') return second

  return first.appliedAt >= second.appliedAt ? first : second
}

function dedupeHistory(history) {
  const grouped = new Map()

  for (const record of history) {
    const key = getRecordKey(record)
    if (!grouped.has(key)) {
      grouped.set(key, record)
      continue
    }

    grouped.set(key, chooseBestRecord(grouped.get(key), record))
  }

  return Array.from(grouped.values())
}

async function readNormalizedHistory() {
  const rawHistory = await readHistory()
  const normalizedHistory = rawHistory.filter(isValidRecord).map(normalizeRecord)
  const cleanedHistory = dedupeHistory(normalizedHistory).sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))

  if (cleanedHistory.length !== normalizedHistory.length) {
    await writeHistory(cleanedHistory)
  }

  return cleanedHistory
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
  return readNormalizedHistory()
}

/**
 * Add a new application record.
 *
 * @param {{ company: string, role: string, url: string }} data
 * @returns {Promise<ApplicationRecord>} The created record (with generated id & timestamp)
 */
export async function addApplicationRecord(data) {
  const record = normalizeRecord(data)
  const history = await readNormalizedHistory()

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
 * Find the index of a record matching company+role+url (case-insensitive).
 * Returns -1 if not found.
 */
function findMatchingIndex(history, { company, role, url }) {
  const c = (company || '').trim().toLowerCase()
  const r = (role || '').trim().toLowerCase()
  const u = (url || '').trim().toLowerCase()

  return history.findIndex((rec) => {
    const rc = (rec.company || '').trim().toLowerCase()
    const rr = (rec.role || '').trim().toLowerCase()
    const ru = (rec.url || '').trim().toLowerCase()

    return rc === c && rr === r && ru === u
  })
}

function findDraftIndexByUrl(history, url) {
  const normalizedUrl = (url || '').trim().toLowerCase()
  let bestIndex = -1
  let bestAppliedAt = ''

  history.forEach((rec, idx) => {
    if (rec?.status !== 'draft') return
    if ((rec.url || '').trim().toLowerCase() !== normalizedUrl) return

    if (bestIndex === -1 || rec.appliedAt > bestAppliedAt) {
      bestIndex = idx
      bestAppliedAt = rec.appliedAt
    }
  })

  return bestIndex
}

/**
 * Save or update a draft application record. If a matching record exists,
 * upgrade its status to `draft` and return it. Otherwise create a new draft.
 * Returns the saved/updated record.
 */
export async function saveDraftApplication(data) {
  const history = await readNormalizedHistory()
  const idx = findMatchingIndex(history, data)

  if (idx !== -1) {
    // Update existing record to draft unless it's already applied
    const existing = normalizeRecord(history[idx])
    if (existing.status === 'applied') {
      console.log('ApplyFlow: Existing record already applied; skipping draft update', { id: existing.id })
      return existing
    }

    const updated = {
      ...existing,
      company: (data.company || existing.company).trim(),
      role: (data.role || existing.role).trim(),
      url: (data.url || existing.url).trim(),
      status: 'draft',
      appliedAt: existing.appliedAt || new Date().toISOString(),
    }

    history[idx] = updated
    await writeHistory(history)
    console.log('ApplyFlow: Updated draft application record', updated)
    return updated
  }

  // Create new draft record
  const rec = normalizeRecord({
    ...data,
    status: 'draft',
    appliedAt: new Date().toISOString(),
  })

  history.push(rec)
  await writeHistory(history)
  console.log('ApplyFlow: Created draft application record', rec)
  return rec
}

/**
 * Mark an application as applied. If a matching draft exists, upgrade it.
 * Prevents duplicates by matching company+role+url.
 * Returns the applied record (new or updated).
 */
export async function markApplicationAsApplied(data) {
  const history = await readNormalizedHistory()
  const idx = findMatchingIndex(history, data)
  const now = new Date().toISOString()

  if (idx !== -1) {
    const existing = normalizeRecord(history[idx])
    if (existing.status === 'applied') {
      console.log('ApplyFlow: Duplicate applied prevented', { id: existing.id })
      return existing
    }

    const updated = {
      ...existing,
      status: 'applied',
      appliedAt: now,
    }

    history[idx] = updated
    await writeHistory(history)
    console.log('ApplyFlow: Upgraded draft -> applied', updated)
    return updated
  }

  const urlFallbackIdx = findDraftIndexByUrl(history, data.url)
  if (urlFallbackIdx !== -1) {
    const existing = normalizeRecord(history[urlFallbackIdx])
    const updated = {
      ...existing,
      status: 'applied',
      appliedAt: now,
    }

    history[urlFallbackIdx] = updated
    await writeHistory(history)
    console.log('ApplyFlow: Upgraded draft -> applied by URL fallback', updated)
    return updated
  }

  // No existing record — create applied record
  const rec = normalizeRecord({
    ...data,
    status: 'applied',
    appliedAt: now,
  })

  if (isDuplicate(history, rec.url)) {
    console.log('ApplyFlow: Skipping duplicate applied record', { url: rec.url })
    return null
  }

  history.push(rec)
  await writeHistory(history)
  console.log('ApplyFlow: Created applied application record', rec)
  return rec
}

/**
 * Delete an application record by id.
 *
 * @param {string} id - Record identifier to remove
 * @returns {Promise<boolean>} `true` if a record was removed, `false` if not found
 */
export async function deleteApplicationRecord(id) {
  const history = await readNormalizedHistory()
  const index = history.findIndex((record) => record.id === id)

  if (index === -1) return false

  history.splice(index, 1)
  await writeHistory(history)

  return true
}
