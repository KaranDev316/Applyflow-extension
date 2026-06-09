import {
  handleAutofill,
  handleDetectFields,
  handleExtractMetadata,
} from './handlers.js'
import { logPageState, markContentScriptLoaded } from './lifecycle.js'
import startSubmissionDetection from './submissionDetection.js'
import { MESSAGE_ACTIONS } from '../types/messages.js'

markContentScriptLoaded()

// Always attach the listener so the extension can recover after a developer reload.
// Vite's module caching prevents this from duplicating within the same context.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('ApplyFlow: Received message:', message.action)

  if (message.action === MESSAGE_ACTIONS.DETECT_FIELDS) {
    const result = handleDetectFields()
    sendResponse(result)
  } else if (message.action === MESSAGE_ACTIONS.EXTRACT_METADATA) {
    const result = handleExtractMetadata()
    sendResponse(result)
  } else if (message.action === MESSAGE_ACTIONS.AUTOFILL) {
    handleAutofill()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true
  } else if (message.action === MESSAGE_ACTIONS.PING) {
    console.log('ApplyFlow: Ping received from popup!')
    sendResponse({
      success: true,
      message: 'Content script is active',
      href: window.location.href,
      readyState: document.readyState,
    })
  }

  return false
})

function startSubmissionDetector() {
  logPageState('Page fully loaded')
  try {
    // Start monitoring for successful submissions so drafts can be upgraded.
    startSubmissionDetection()
  } catch (err) {
    console.warn('ApplyFlow: Failed to start submission detection', err)
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('load', startSubmissionDetector, { once: true })
} else {
  startSubmissionDetector()
}
