import { extractPageMetadata } from '../utils/metadataExtractor.js'
import { markApplicationAsApplied } from '../storage/applicationHistory.js'

const SUCCESS_PATTERNS = [
  /application submitted/i,
  /thank you for applying/i,
  /thank you for your application/i,
  /application received/i,
  /your application has been received/i,
]

const URL_PATTERNS = [/confirm/i, /confirmation/i, /thank-you/i, /submitted/i]

function textMatchesSuccess(text) {
  if (!text) return false
  return SUCCESS_PATTERNS.some((pat) => pat.test(text))
}

function urlLooksLikeConfirmation(url) {
  if (!url) return false
  return URL_PATTERNS.some((pat) => pat.test(url))
}

/**
 * Start the submission detection system.
 * Returns a `stop()` function to remove listeners and restore wrappers.
 */
export function startSubmissionDetection({ timeoutMs = 15000 } = {}) {
  console.log('ApplyFlow: Initializing submission detector')

  let stopped = false
  let appliedMarked = false
  let pendingSubmission = null // { ts, metadata, url }

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

  async function markApplied(reason, metadata, overriddenUrl) {
    if (appliedMarked) return
    appliedMarked = true

    try {
      const meta = metadata || safeExtractMetadata()
      const key = {
        company: meta.company,
        role: meta.role,
        url: overriddenUrl || window.location.href,
      }

      const rec = await markApplicationAsApplied(key)
      if (rec) {
        console.log('ApplyFlow: Submission detected; marked as applied', { reason, record: rec })
      } else {
        console.log('ApplyFlow: Submission detected but record not created (duplicate or prevented)', { reason })
      }
    } catch (err) {
      console.warn('ApplyFlow: Failed to mark application as applied', err)
    }
  }

  function onUrlChange(reason) {
    if (stopped || appliedMarked) return
    try {
      const href = window.location.href
      if (urlLooksLikeConfirmation(href)) {
        console.log('ApplyFlow: Confirmation URL detected', { href, reason })
        const appliedUrl = pendingSubmission ? pendingSubmission.url : undefined
        const meta = pendingSubmission ? pendingSubmission.metadata : undefined
        markApplied('url-change', meta, appliedUrl)
        return
      }

      // SPA navigation may change page content; also check for success text
      if (document && document.body && textMatchesSuccess(document.body.textContent)) {
        console.log('ApplyFlow: Success text detected after navigation', { reason })
        const appliedUrl = pendingSubmission ? pendingSubmission.url : undefined
        const meta = pendingSubmission ? pendingSubmission.metadata : undefined
        markApplied('url-change-text', meta, appliedUrl)
      }
    } catch (err) {
      // ignore
    }
  }

  // Observe history API for SPA navigation
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
    window.addEventListener('popstate', () => onUrlChange('popstate'))
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
              console.log('ApplyFlow: Success text found in DOM mutation')
              markApplied('dom-mutation')
              return
            }
            // Also check subtree quickly
            if (node && node.querySelectorAll) {
              const allText = node.textContent || ''
              if (textMatchesSuccess(allText)) {
                console.log('ApplyFlow: Success text found in DOM subtree mutation')
                markApplied('dom-mutation-subtree')
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
          if (!appliedMarked && method && method.toUpperCase() === 'POST' && /apply|applications|jobs|submission|candidate|candidates/i.test(url)) {
            if (response && response.ok) {
              console.log('ApplyFlow: Detected successful fetch POST', { url })
              const meta = pendingSubmission ? pendingSubmission.metadata : safeExtractMetadata()
              const appliedUrl = pendingSubmission ? pendingSubmission.url : undefined
              markApplied('fetch-post', meta, appliedUrl)
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
            if (!appliedMarked && method === 'POST' && /apply|applications|jobs|submission|candidate|candidates/i.test(url) && this.status >= 200 && this.status < 300) {
              console.log('ApplyFlow: Detected successful XHR POST', { url, status: this.status })
              const meta = pendingSubmission ? pendingSubmission.metadata : safeExtractMetadata()
              const appliedUrl = pendingSubmission ? pendingSubmission.url : undefined
              markApplied('xhr-post', meta, appliedUrl)
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
      const form = e.target
      const meta = safeExtractMetadata()
      pendingSubmission = {
        ts: Date.now(),
        metadata: meta,
        url: window.location.href,
      }

      console.log('ApplyFlow: Form submit observed — awaiting confirmation', { url: pendingSubmission.url })

      // If nothing confirms within timeout, clear pendingSubmission and log failure
      setTimeout(() => {
        if (pendingSubmission && Date.now() - pendingSubmission.ts >= timeoutMs) {
          console.log('ApplyFlow: Submission confirmation timeout — no success detected', { url: pendingSubmission.url })
          pendingSubmission = null
        }
      }, timeoutMs)
    } catch (err) {
      // ignore
    }
  }

  document.addEventListener('submit', onFormSubmit, true)

  // Initial check on load: URL or success text
  try {
    if (urlLooksLikeConfirmation(window.location.href) || (document && document.body && textMatchesSuccess(document.body.textContent))) {
      console.log('ApplyFlow: Initial page looks like confirmation')
      const appliedUrl = pendingSubmission ? pendingSubmission.url : undefined
      const meta = pendingSubmission ? pendingSubmission.metadata : undefined
      markApplied('initial-check', meta, appliedUrl)
    }
  } catch (err) {
    // ignore
  }

  // Stop function: restores originals and removes listeners
  function stop() {
    stopped = true
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
      window.removeEventListener('popstate', onUrlChange)
    } catch (e) {}

    try {
      document.removeEventListener('submit', onFormSubmit, true)
    } catch (e) {}

    console.log('ApplyFlow: Submission detector stopped')
  }

  return stop
}

export default startSubmissionDetection
