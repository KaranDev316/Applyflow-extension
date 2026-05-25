import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { JSDOM } from 'jsdom'
import { getApplicationHistory, saveDraftApplication } from '../src/storage/applicationHistory.js'
import { startSubmissionDetection } from '../src/content/submissionDetection.js'

let backingStore
let nextStorageError
let dom

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

function initDom(href = 'https://jobs.greenhouse.io/role') {
  dom = new JSDOM('<!doctype html><html><body><div class="company-name">Initech</div><div class="app-title">Developer</div></body></html>', {
    url: href,
    runScripts: 'dangerously',
    resources: 'usable',
  })

  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.location = dom.window.location
  globalThis.history = dom.window.history
  globalThis.navigator = dom.window.navigator
  globalThis.XMLHttpRequest = dom.window.XMLHttpRequest
  globalThis.MutationObserver = dom.window.MutationObserver
  globalThis.Event = dom.window.Event
  globalThis.fetch = dom.window.fetch || globalThis.fetch
}

beforeEach(() => {
  installChromeStorageMock()
  initDom()
})

test('Submission confirmation via fetch POST upgrades draft', async () => {
  await saveDraftApplication({
    company: 'Initech',
    role: 'Developer',
    url: 'https://jobs.greenhouse.io/role',
  })

  globalThis.window.fetch = async (input, init) => ({ ok: true, status: 200, url: typeof input === 'string' ? input : input.url })

  const stop = startSubmissionDetection({ timeoutMs: 100 })
  const form = document.createElement('form')
  document.body.appendChild(form)
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))

  await globalThis.window.fetch('https://api.greenhouse.io/apply', { method: 'POST' })

  // allow the detector to settle
  await new Promise((resolve) => setTimeout(resolve, 20))

  const history = await getApplicationHistory()
  assert.equal(history.length, 1)
  assert.equal(history[0].status, 'applied')
  stop()
})

test('Successful application POST without submit intent does not mark applied', async () => {
  await saveDraftApplication({
    company: 'Initech',
    role: 'Developer',
    url: 'https://jobs.greenhouse.io/role',
  })

  globalThis.window.fetch = async (input, init) => ({ ok: true, status: 200, url: typeof input === 'string' ? input : input.url })

  const stop = startSubmissionDetection({ timeoutMs: 100 })
  await globalThis.window.fetch('https://api.greenhouse.io/apply', { method: 'POST' })

  await new Promise((resolve) => setTimeout(resolve, 20))

  const history = await getApplicationHistory()
  assert.equal(history.length, 1)
  assert.equal(history[0].status, 'draft')
  stop()
})

test('Submission confirmation via URL change upgrades draft', async () => {
  await saveDraftApplication({
    company: 'Initech',
    role: 'Developer',
    url: 'https://jobs.greenhouse.io/role',
  })

  const stop = startSubmissionDetection({ timeoutMs: 100 })
  const form = document.createElement('form')
  document.body.appendChild(form)
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))

  globalThis.window.history.pushState({}, '', '/confirmation')

  await new Promise((resolve) => setTimeout(resolve, 20))

  const history = await getApplicationHistory()
  assert.equal(history.length, 1)
  assert.equal(history[0].status, 'applied')
  stop()
})

test('Success text mutation upgrades draft', async () => {
  await saveDraftApplication({
    company: 'Initech',
    role: 'Developer',
    url: 'https://jobs.greenhouse.io/role',
  })

  const stop = startSubmissionDetection({ timeoutMs: 100 })
  const form = document.createElement('form')
  document.body.appendChild(form)
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))

  const successMessage = document.createElement('div')
  successMessage.textContent = 'Thank you for applying to this role.'
  document.body.appendChild(successMessage)

  await new Promise((resolve) => setTimeout(resolve, 20))

  const history = await getApplicationHistory()
  assert.equal(history.length, 1)
  assert.equal(history[0].status, 'applied')
  stop()
})

test('Success text without submit intent does not mark applied', async () => {
  await saveDraftApplication({
    company: 'Initech',
    role: 'Developer',
    url: 'https://jobs.greenhouse.io/role',
  })

  const stop = startSubmissionDetection({ timeoutMs: 100 })

  const successMessage = document.createElement('div')
  successMessage.textContent = 'Thank you for applying to this role.'
  document.body.appendChild(successMessage)

  await new Promise((resolve) => setTimeout(resolve, 20))

  const history = await getApplicationHistory()
  assert.equal(history.length, 1)
  assert.equal(history[0].status, 'draft')
  stop()
})

test('Confirmation-looking URL without submit intent does not mark applied', async () => {
  initDom('https://jobs.greenhouse.io/confirmation')
  await saveDraftApplication({
    company: 'Initech',
    role: 'Developer',
    url: 'https://jobs.greenhouse.io/role',
  })

  const stop = startSubmissionDetection({ timeoutMs: 100 })

  await new Promise((resolve) => setTimeout(resolve, 20))

  const history = await getApplicationHistory()
  assert.equal(history.length, 1)
  assert.equal(history[0].status, 'draft')
  stop()
})

test('Submit event alone does not upgrade draft without confirmation', async () => {
  await saveDraftApplication({
    company: 'Initech',
    role: 'Developer',
    url: 'https://jobs.greenhouse.io/role',
  })

  const stop = startSubmissionDetection({ timeoutMs: 50 })
  const form = document.createElement('form')
  document.body.appendChild(form)
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))

  await new Promise((resolve) => setTimeout(resolve, 80))

  const history = await getApplicationHistory()
  assert.equal(history.length, 1)
  assert.equal(history[0].status, 'draft')
  stop()
})

test('Failed fetch POST does not mark application as applied', async () => {
  await saveDraftApplication({
    company: 'Initech',
    role: 'Developer',
    url: 'https://jobs.greenhouse.io/role',
  })

  globalThis.window.fetch = async (input, init) => ({ ok: false, status: 400, url: typeof input === 'string' ? input : input.url })

  const stop = startSubmissionDetection({ timeoutMs: 100 })
  await globalThis.window.fetch('https://api.greenhouse.io/apply', { method: 'POST' })

  await new Promise((resolve) => setTimeout(resolve, 20))

  const history = await getApplicationHistory()
  assert.equal(history.length, 1)
  assert.equal(history[0].status, 'draft')
  stop()
})
