import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import {
  getApplicationHistory,
  addApplicationRecord,
  deleteApplicationRecord,
} from '../src/storage/applicationHistory.js'

let backingStore
let nextStorageError

function installChromeStorageMock() {
  backingStore = {}
  nextStorageError = null

  globalThis.chrome = {
    runtime: {
      lastError: null,
    },
    storage: {
      local: {
        get(key, callback) {
          globalThis.chrome.runtime.lastError = nextStorageError
          nextStorageError = null

          if (Array.isArray(key)) {
            callback(Object.fromEntries(key.map((itemKey) => [itemKey, backingStore[itemKey]])))
            return
          }

          callback({ [key]: backingStore[key] })
        },
        set(values, callback) {
          globalThis.chrome.runtime.lastError = nextStorageError
          nextStorageError = null

          if (!globalThis.chrome.runtime.lastError) {
            backingStore = {
              ...backingStore,
              ...values,
            }
          }

          callback()
        },
      },
    },
  }
}

beforeEach(() => {
  installChromeStorageMock()
})

test('Applications save after autofill (addApplicationRecord)', async () => {
  const rec = await addApplicationRecord({ company: 'Initech', role: 'Developer', url: 'https://jobs/example/1' })
  assert.equal(typeof rec.id, 'string')

  const history = await getApplicationHistory()
  assert.equal(history.length, 1)
  assert.equal(history[0].company, 'Initech')
  assert.equal(history[0].role, 'Developer')
})

test('Duplicate applications handled correctly', async () => {
  const url = 'https://jobs/example/dup'
  const first = await addApplicationRecord({ company: 'Duo', role: 'Engineer', url })
  assert.ok(first)

  const second = await addApplicationRecord({ company: 'Duo', role: 'Engineer', url })
  assert.equal(second, null)

  const history = await getApplicationHistory()
  assert.equal(history.length, 1)
})

test('Missing company names handled gracefully', async () => {
  const rec = await addApplicationRecord({ company: '', role: 'Analyst', url: 'https://jobs/example/3' })
  const history = await getApplicationHistory()
  assert.equal(history.length, 1)
  assert.equal(history[0].company, '')
  assert.equal(history[0].role, 'Analyst')
})

test('Tracker persists after browser restart', async () => {
  await addApplicationRecord({ company: 'PersistCo', role: 'PM', url: 'https://jobs/example/4' })
  const saved = { ...backingStore }

  // Simulate browser restart by reinstalling mock with preserved backing store
  installChromeStorageMock()
  backingStore = saved

  const history = await getApplicationHistory()
  assert.equal(history.length, 1)
  assert.equal(history[0].company, 'PersistCo')
})

test('Delete functionality removes item correctly', async () => {
  const a = await addApplicationRecord({ company: 'ToDelete', role: 'X', url: 'https://jobs/example/5' })
  const b = await addApplicationRecord({ company: 'Keep', role: 'Y', url: 'https://jobs/example/6' })

  let history = await getApplicationHistory()
  assert.equal(history.length, 2)

  const removed = await deleteApplicationRecord(a.id)
  assert.equal(removed, true)

  history = await getApplicationHistory()
  assert.equal(history.length, 1)
  assert.equal(history[0].company, 'Keep')

  const removedNon = await deleteApplicationRecord('non-existent')
  assert.equal(removedNon, false)
})

test('Dashboard metrics update correctly (total and today counts)', async () => {
  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  await addApplicationRecord({ company: 'Today1', role: 'A', url: 'https://jobs/today1', appliedAt: new Date().toISOString() })
  await addApplicationRecord({ company: 'Today2', role: 'B', url: 'https://jobs/today2', appliedAt: new Date().toISOString() })
  await addApplicationRecord({ company: 'Yesterday', role: 'C', url: 'https://jobs/yesterday', appliedAt: yesterday })

  const history = await getApplicationHistory()
  const total = history.length
  const todayCount = history.filter((r) => {
    const d = new Date(r.appliedAt)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  }).length

  assert.equal(total, 3)
  assert.equal(todayCount, 2)
})
