import { extractPageMetadata } from '../utils/metadataExtractor.js'
import { markApplicationAsApplied } from '../storage/applicationHistory.js'

const SUCCESS_PATTERNS = [
  /application submitted/i,
  /thank you for applying/i,
  /thank you for your application/i,
  /application received/i,
]

const URL_PATTERNS = [/confirm/i, /confirmation/i, /thank-you/i]

function textMatchesSuccess(text) {
  if (!text) return false
  return SUCCESS_PATTERNS.some((pat) => pat.test(text))
}

function urlLooksLikeConfirmation(url) {
  if (!url) return false
  return URL_PATTERNS.some((pat) => pat.test(url))
}

export function startSubmissionDetection() {
  let stopped = false
  let observed = false

  function markAppliedIfPossible(reason) {
    try {
      const metadata = extractPageMetadata()
      const key = {
        company: metadata.company,
        role: metadata.role,
        url: window.location.href,
      }

      markApplicationAsApplied(key).then((rec) => {
        if (rec) {
          console.log('ApplyFlow: Submission detected; marked as applied', { reason, record: rec })
        } else {
          console.log('ApplyFlow: Submission detected but record not created (possible duplicate)', { reason })
        }
      }).catch((err) => {
        console.warn('ApplyFlow: Failed to mark application as applied', err)
      })
    } catch (err) {
      console.warn('ApplyFlow: Error while attempting to mark applied', err)
    }
  }

  // Immediate check on load
  try {
    if (urlLooksLikeConfirmation(window.location.href) || textMatchesSuccess(document.body && document.body.textContent)) {
      observed = true
      markAppliedIfPossible('initial-check')
    }
  } catch (e) {
    // ignore
  }

  // Observe DOM changes for success messages
  const observer = new MutationObserver((mutations) => {
    if (stopped) return
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length > 0) {
        for (const node of m.addedNodes) {
          try {
            const text = node.textContent || ''
            if (textMatchesSuccess(text)) {
              if (!observed) {
                observed = true
                markAppliedIfPossible('dom-mutation')
                return
              }
            }
          } catch (err) {
            // pass
          }
        }
      }
    }
  })

  try {
    observer.observe(document.body, { childList: true, subtree: true })
  } catch (err) {
    // ignore if document.body not ready
  }

  // Intercept fetch to detect POSTs to application endpoints
  try {
    if (window.fetch) {
      const nativeFetch = window.fetch
      window.fetch = async function (input, init) {
        const res = await nativeFetch.apply(this, arguments)
        try {
          const url = (typeof input === 'string') ? input : input.url
          const method = (init && init.method) || (res && res.type) || 'GET'
          if (!observed && method && method.toUpperCase() === 'POST' && /apply|applications|jobs|submission/i.test(url)) {
            if (res.ok) {
              observed = true
              markAppliedIfPossible('fetch-post')
            }
          }
        } catch (err) {
          // ignore
        }
        return res
      }
    }
  } catch (err) {
    // ignore
  }

  // Intercept XMLHttpRequest
  try {
    const NativeXHR = window.XMLHttpRequest
    if (NativeXHR) {
      function WrappedXHR() {
        const xhr = new NativeXHR()
        const origOpen = xhr.open
        xhr.open = function (method, url) {
          this.__applyflow_url = url
          this.__applyflow_method = method
          return origOpen.apply(this, arguments)
        }
        xhr.addEventListener('load', function () {
          try {
            const method = (this.__applyflow_method || '').toUpperCase()
            const url = this.__applyflow_url || ''
            if (!observed && method === 'POST' && /apply|applications|jobs|submission/i.test(url) && this.status >= 200 && this.status < 300) {
              observed = true
              markAppliedIfPossible('xhr-post')
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
    // ignore
  }

  return function stop() {
    stopped = true
    try {
      observer.disconnect()
    } catch (e) {}
  }
}

export default startSubmissionDetection
