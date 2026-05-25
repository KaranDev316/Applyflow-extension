import { extractPageMetadata } from '../utils/metadataExtractor.js'
import { markApplicationAsApplied } from '../storage/applicationHistory.js'

const SUCCESS_PATTERNS = [
  /application submitted/i,
  /thank you for applying/i,
  /thank you for your application/i,
  /application (?:has been )?(?:successfully )?(?:received|submitted)/i,
  /your application has been received/i,
  /we(?:'|’)ve received your application/i,
]

const URL_PATTERNS = [
  /\/confirm(?:ation)?(?:\/|$|[?#])/i,
  /\/thank-you(?:\/|$|[?#])/i,
  /\/application-submitted(?:\/|$|[?#])/i,
  /\/submitted(?:\/|$|[?#])/i,
]
const SUBMISSION_ENDPOINT_PATTERN = /\/(?:apply|applications|submission|submissions|candidate|candidates)(?:\/|$|[?#])/i
const SUBMIT_INTENT_PATTERN = /\b(?:submit|send|apply|finish|complete)\b/i
const PENDING_SUBMISSION_KEY = 'applyflowPendingSubmission'

function textMatchesSuccess(text) {
  if (!text) return false
  return SUCCESS_PATTERNS.some((pat) => pat.test(text))
}

function urlLooksLikeConfirmation(url) {
  if (!url) return false
  return URL_PATTERNS.some((pat) => pat.test(url))
}

function getStorage() {
  return globalThis.chrome?.storage?.local
}

function getLastError() {
  return globalThis.chrome?.runtime?.lastError
}

function readPendingSubmission() {
  const storage = getStorage()
  if (!storage) return Promise.resolve(null)

  return new Promise((resolve) => {
    storage.get(PENDING_SUBMISSION_KEY, (result) => {
      if (getLastError()) {
        resolve(null)
        return
      }

      const pending = result?.[PENDING_SUBMISSION_KEY]
      resolve(pending && typeof pending === 'object' ? pending : null)
    })
  })
}

function writePendingSubmission(pending) {
  const storage = getStorage()
  if (!storage) return Promise.resolve()

  return new Promise((resolve) => {
    storage.set({ [PENDING_SUBMISSION_KEY]: pending }, resolve)
  })
}

function clearPendingSubmission() {
  return writePendingSubmission(null)
}

function isFreshPendingSubmission(pending, timeoutMs) {
  if (!pending || typeof pending !== 'object') return false
  if (!pending.url || typeof pending.url !== 'string') return false
  const ts = Number(pending.ts)
  return Number.isFinite(ts) && Date.now() - ts <= timeoutMs
}

function isLikelySubmitIntent(target) {
  if (!target || !target.closest) return false
  const control = target.closest('button, input, a, [role="button"]')
  if (!control) return false

  const type = (control.getAttribute('type') || '').toLowerCase()
  const text = `${control.innerText || ''} ${control.value || ''} ${control.getAttribute('aria-label') || ''}`.trim()

  return type === 'submit' || SUBMIT_INTENT_PATTERN.test(text)
}

export function hasStrongConfirmationSignal(signal = {}) {
  if (!signal || typeof signal !== 'object') return false

  if (signal.type === 'url') {
    return urlLooksLikeConfirmation(signal.url)
  }

  if (signal.type === 'text') {
    return textMatchesSuccess(signal.text)
  }

  if (signal.type === 'network') {
    const method = (signal.method || '').toUpperCase()
    const status = Number(signal.status)
    return method === 'POST' && status >= 200 && status < 300 && SUBMISSION_ENDPOINT_PATTERN.test(signal.url || '')
  }

  return false
}

/**
 * Start the submission detection system.
 * Returns a `stop()` function to remove listeners and restore wrappers.
 */
export function startSubmissionDetection({ timeoutMs = 15000 } = {}) {
  console.log('ApplyFlow: Initializing submission detector')

  let stopped = false
  let appliedMarked = false
  let appliedTransitionInProgress = false
  let pendingSubmission = null // { ts, metadata, url }
  const pendingTimers = new Set()

  // Keep originals so we can restore on stop
  const originals = {
    fetch: window.fetch,
    XHR: window.XMLHttpRequest,
    pushState: history.pushState,
    replaceState: history.replaceState,
  }

  function safeExtractMetadata() {
    try {
      return extractPageMetadata() || {}
    } catch (err) {
      return {}
    }
  }

  function clearPendingTimers() {
    pendingTimers.forEach((timerId) => window.clearTimeout(timerId))
    pendingTimers.clear()
  }

  async function getFreshPendingSubmission() {
    if (isFreshPendingSubmission(pendingSubmission, timeoutMs)) {
      return pendingSubmission
    }

    const persistedPending = await readPendingSubmission()
    if (isFreshPendingSubmission(persistedPending, timeoutMs)) {
      pendingSubmission = persistedPending
      return persistedPending
    }

    if (persistedPending) {
      console.log('ApplyFlow: Ignoring stale pending submission', {
        ageMs: Date.now() - Number(persistedPending.ts || 0),
        url: persistedPending.url,
      })
      await clearPendingSubmission()
    }

    return null
  }

  async function rememberSubmissionIntent(reason) {
    const meta = safeExtractMetadata()
    pendingSubmission = {
      ts: Date.now(),
      metadata: meta,
      url: window.location.href,
    }
    await writePendingSubmission(pendingSubmission)
    console.log('ApplyFlow: Submission intent observed — awaiting confirmation', {
      reason,
      url: pendingSubmission.url,
      role: meta.role,
      company: meta.company,
    })
  }

  async function markApplied(reason, signal) {
    if (appliedMarked || appliedTransitionInProgress) return

    if (!hasStrongConfirmationSignal(signal)) {
      console.log('ApplyFlow: Ignoring weak submission signal', { reason, signal })
      return
    }

    appliedTransitionInProgress = true

    const pending = await getFreshPendingSubmission()
    if (!pending) {
      console.log('ApplyFlow: Strong confirmation ignored without pending submission intent', {
        reason,
        signal,
      })
      appliedTransitionInProgress = false
      return
    }

    appliedMarked = true

    try {
      const meta = pending.metadata || safeExtractMetadata()
      const key = {
        company: meta.company,
        role: meta.role,
        url: pending.url,
      }

      const rec = await markApplicationAsApplied(key)
      if (rec) {
        console.log('ApplyFlow: Applied transition committed', {
          reason,
          signal,
          pendingUrl: pending.url,
          record: rec,
        })
      } else {
        console.log('ApplyFlow: Applied transition detected but record not created', {
          reason,
          signal,
          pendingUrl: pending.url,
        })
      }
      pendingSubmission = null
      clearPendingTimers()
      await clearPendingSubmission()
    } catch (err) {
      appliedMarked = false
      console.warn('ApplyFlow: Failed to mark application as applied', err)
    } finally {
      appliedTransitionInProgress = false
    }
  }

  function onUrlChange(reason) {
    if (stopped || appliedMarked) return
    try {
      const href = window.location.href
      if (urlLooksLikeConfirmation(href)) {
        markApplied('url-change', { type: 'url', url: href })
        return
      }

      // SPA navigation may change page content; also check for success text
      if (document && document.body && textMatchesSuccess(document.body.textContent)) {
        markApplied('url-change-text', { type: 'text', text: document.body.textContent })
      }
    } catch (err) {
      // ignore
    }
  }

  // Observe history API for SPA navigation
  const onPopState = () => onUrlChange('popstate')

  try {
    history.pushState = function () {
      const res = originals.pushState.apply(this, arguments)
      onUrlChange('pushState')
      return res
    }
    history.replaceState = function () {
      const res = originals.replaceState.apply(this, arguments)
      onUrlChange('replaceState')
      return res
    }
    window.addEventListener('popstate', onPopState)
  } catch (err) {
    console.warn('ApplyFlow: Failed to wrap history API', err)
  }

  // DOM mutation observer for success messages
  const observer = new MutationObserver((mutations) => {
    if (stopped || appliedMarked) return
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length > 0) {
        for (const node of m.addedNodes) {
          try {
            const text = (node && node.textContent) || ''
            if (textMatchesSuccess(text)) {
              markApplied('dom-mutation', { type: 'text', text })
              return
            }
            // Also check subtree quickly
            if (node && node.querySelectorAll) {
              const allText = node.textContent || ''
              if (textMatchesSuccess(allText)) {
                markApplied('dom-mutation-subtree', { type: 'text', text: allText })
                return
              }
            }
          } catch (err) {
            // ignore
          }
        }
      }
    }
  })

  try {
    observer.observe(document.body, { childList: true, subtree: true })
  } catch (err) {
    // body may not be ready
  }

  // Intercept fetch to detect POSTs to application endpoints. Respect original behavior.
  try {
    if (originals.fetch) {
      window.fetch = async function (input, init) {
        const url = typeof input === 'string' ? input : (input && input.url) || ''
        const method = (init && init.method) || 'GET'
        try {
          const response = await originals.fetch.apply(this, arguments)

          // Heuristic: POST to likely application endpoints with success status
          if (!appliedMarked && method && method.toUpperCase() === 'POST' && SUBMISSION_ENDPOINT_PATTERN.test(url)) {
            if (response && response.ok) {
              markApplied('fetch-post', {
                type: 'network',
                method,
                status: response.status || 200,
                url,
              })
            } else {
              console.log('ApplyFlow: Fetch POST returned non-ok', { url, ok: !!(response && response.ok) })
            }
          }

          return response
        } catch (err) {
          // In case of network error, don't mark applied
          console.warn('ApplyFlow: Fetch wrapper caught error', err)
          throw err
        }
      }
    }
  } catch (err) {
    console.warn('ApplyFlow: Failed to wrap fetch', err)
  }

  // Wrap XMLHttpRequest similarly
  try {
    const NativeXHR = originals.XHR
    if (NativeXHR) {
      function WrappedXHR() {
        const xhr = new NativeXHR()
        const origOpen = xhr.open
        xhr.open = function (method, url) {
          try {
            this.__applyflow_url = url
            this.__applyflow_method = method
          } catch (e) {}
          return origOpen.apply(this, arguments)
        }

        xhr.addEventListener('load', function () {
          try {
            const method = (this.__applyflow_method || '').toUpperCase()
            const url = this.__applyflow_url || ''
            if (!appliedMarked && method === 'POST' && SUBMISSION_ENDPOINT_PATTERN.test(url) && this.status >= 200 && this.status < 300) {
              markApplied('xhr-post', {
                type: 'network',
                method,
                status: this.status,
                url,
              })
            }
          } catch (err) {
            // ignore
          }
        })

        return xhr
      }
      window.XMLHttpRequest = WrappedXHR
    }
  } catch (err) {
    console.warn('ApplyFlow: Failed to wrap XHR', err)
  }

  // Form submit observer: wait for success via other signals, do not mark on submit alone.
  function onFormSubmit(e) {
    try {
      rememberSubmissionIntent('form-submit')

      // If nothing confirms within timeout, clear pendingSubmission and log failure
      const timerId = window.setTimeout(() => {
        pendingTimers.delete(timerId)
        if (pendingSubmission && Date.now() - pendingSubmission.ts >= timeoutMs) {
          console.log('ApplyFlow: Submission confirmation timeout — no success detected', { url: pendingSubmission.url })
          pendingSubmission = null
          clearPendingSubmission()
        }
      }, timeoutMs)
      pendingTimers.add(timerId)
    } catch (err) {
      // ignore
    }
  }

  document.addEventListener('submit', onFormSubmit, true)

  function onClick(e) {
    if (stopped || appliedMarked) return
    if (!isLikelySubmitIntent(e.target)) return
    rememberSubmissionIntent('submit-click')
  }

  document.addEventListener('click', onClick, true)

  // Initial check on load handles confirmation pages after a real submit
  // navigation, but still requires a fresh persisted pending submission.
  markApplied('initial-check-url', { type: 'url', url: window.location.href })
  if (document && document.body) {
    markApplied('initial-check-text', { type: 'text', text: document.body.textContent })
  }

  // Stop function: restores originals and removes listeners
  function stop() {
    stopped = true
    clearPendingTimers()

    try {
      observer.disconnect()
    } catch (e) {}

    try {
      if (originals.fetch) window.fetch = originals.fetch
    } catch (e) {}

    try {
      if (originals.XHR) window.XMLHttpRequest = originals.XHR
    } catch (e) {}

    try {
      history.pushState = originals.pushState
      history.replaceState = originals.replaceState
    } catch (e) {}

    try {
      window.removeEventListener('popstate', onPopState)
    } catch (e) {}

    try {
      document.removeEventListener('submit', onFormSubmit, true)
    } catch (e) {}

    try {
      document.removeEventListener('click', onClick, true)
    } catch (e) {}

    console.log('ApplyFlow: Submission detector stopped')
  }

  return stop
}

export default startSubmissionDetection
