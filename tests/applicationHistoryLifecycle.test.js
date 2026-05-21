import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import {
  getApplicationHistory,
  saveDraftApplication,
  markApplicationAsApplied,
  addApplicationRecord,
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

test('Autofill saves draft record only', async () => {
  const draft = await saveDraftApplication({
    company: 'Initech',
    role: 'Developer',
    url: 'https://jobs/example/1',
  })

  assert.equal(draft.status, 'draft')
  assert.equal(draft.company, 'Initech')
  assert.equal(draft.role, 'Developer')

  const history = await getApplicationHistory()
  assert.equal(history.length, 1)
  assert.equal(history[0].status, 'draft')
})

test('Successful submission upgrades draft to applied', async () => {
  await saveDraftApplication({
    company: 'Initech',
    role: 'Developer',
    url: 'https://jobs/example/1',
  })

  const applied = await markApplicationAsApplied({
    company: 'Initech',
    role: 'Developer',
    url: 'https://jobs/example/1',
  })

  assert.equal(applied.status, 'applied')
  const history = await getApplicationHistory()
  assert.equal(history.length, 1)
  assert.equal(history[0].status, 'applied')
})

test('Duplicate autofill updates existing draft instead of new record', async () => {
  const first = await saveDraftApplication({
    company: 'Initech',
    role: 'Developer',
    url: 'https://jobs/example/1',
  })
  const second = await saveDraftApplication({
    company: 'Initech',
    role: 'Developer',
    url: 'https://jobs/example/1',
  })

  assert.equal(first.id, second.id)
  const history = await getApplicationHistory()
  assert.equal(history.length, 1)
  assert.equal(history[0].status, 'draft')
})

test('Duplicate application submissions do not create multiple applied records', async () => {
  await saveDraftApplication({
    company: 'Initech',
    role: 'Developer',
    url: 'https://jobs/example/1',
  })

  const first = await markApplicationAsApplied({
    company: 'Initech',
    role: 'Developer',
    url: 'https://jobs/example/1',
  })
  const second = await markApplicationAsApplied({
    company: 'Initech',
    role: 'Developer',
    url: 'https://jobs/example/1',
  })

  assert.equal(first.id, second.id)
  assert.equal(second.status, 'applied')

  const history = await getApplicationHistory()
  assert.equal(history.length, 1)
})

test('Same job title at different companies creates separate records', async () => {
  await saveDraftApplication({
    company: 'AlphaCorp',
    role: 'Engineer',
    url: 'https://jobs/example/alpha',
  })
  await saveDraftApplication({
    company: 'BetaCorp',
    role: 'Engineer',
    url: 'https://jobs/example/beta',
  })

  const history = await getApplicationHistory()
  assert.equal(history.length, 2)
})

test('Company/title capitalization does not create duplicate records for same job', async () => {
  await saveDraftApplication({
    company: 'Acme Inc',
    role: 'Frontend Developer',
    url: 'https://jobs/example/1',
  })
  await saveDraftApplication({
    company: 'acme inc',
    role: 'frontend developer',
    url: 'https://jobs/example/1',
  })

  const history = await getApplicationHistory()
  assert.equal(history.length, 1)
})

test('Legacy records without status still normalize safely', async () => {
  backingStore.applicationHistory = [
    {
      id: 'legacy-1',
      company: 'LegacyCo',
      role: 'Old Role',
      url: 'https://jobs/legacy',
      appliedAt: new Date().toISOString(),
    },
  ]

  const history = await getApplicationHistory()
  assert.equal(history.length, 1)
  assert.equal(history[0].status, 'applied')
  assert.equal(history[0].company, 'LegacyCo')
})

test('Application history sorts newest first', async () => {
  const older = new Date(Date.now() - 1000 * 60 * 60).toISOString()
  const newer = new Date().toISOString()

  await addApplicationRecord({ company: 'OldCo', role: 'Dev', url: 'https://jobs/old', appliedAt: older })
  await addApplicationRecord({ company: 'NewCo', role: 'Dev', url: 'https://jobs/new', appliedAt: newer })

  const history = await getApplicationHistory()
  assert.equal(history.length, 2)
  assert.equal(history[0].company, 'NewCo')
  assert.equal(history[1].company, 'OldCo')
})
