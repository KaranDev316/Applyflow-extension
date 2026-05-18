/**
 * Content script for ApplyFlow Chrome extension
 * Runs on Greenhouse and Lever application pages
 * Handles field detection, metadata extraction, and autofill operations.
 */

import { detectFormFields, formatFieldsForLogging } from './utils/fieldDetection.js'
import { getProfileFromStorage } from './utils/storageUtil.js'
import {
  autofillFromProfile,
  autofillCheckboxes,
  autofillSelects,
} from './utils/autofillEngine.js'
import { extractPageMetadata } from './utils/metadataExtractor.js'
import { recordAutofillRun } from './utils/autofillStats.js'

// ---------------------------------------------------------------------------
// Duplicate-load guard
// ---------------------------------------------------------------------------

const wasContentScriptLoaded = globalThis.__APPLYFLOW_CONTENT_SCRIPT_LOADED__ === true

if (wasContentScriptLoaded) {
  console.log('ApplyFlow content script already loaded; skipping duplicate listener')
} else {
  globalThis.__APPLYFLOW_CONTENT_SCRIPT_LOADED__ = true
  console.log('ApplyFlow content script loaded')
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_READY_DELAY_MS = 250
const FIELD_DETECTION_RETRIES = 10
const FIELD_DETECTION_RETRY_MS = 250
const MUTATION_WAIT_MS = 1500 // max time to wait for DOM mutations

// ---------------------------------------------------------------------------
// Duplicate-autofill guard
// ---------------------------------------------------------------------------

let isAutofillRunning = false

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function logPageState(eventName, extra = {}) {
  console.log('ApplyFlow:', eventName, {
    href: window.location.href,
    readyState: document.readyState,
    time: Math.round(performance.now()),
    ...extra,
  })
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function waitForPageReady() {
  if (document.readyState === 'complete') {
    return new Promise((resolve) => {
      window.setTimeout(resolve, PAGE_READY_DELAY_MS)
    })
  }

  return new Promise((resolve) => {
    window.addEventListener(
      'load',
      () => {
        window.setTimeout(resolve, PAGE_READY_DELAY_MS)
      },
      { once: true },
    )
  })
}

/**
 * Wait for DOM mutations to settle (React / dynamic form rendering).
 * Resolves once no new mutations are observed for a short quiet period,
 * or after MUTATION_WAIT_MS, whichever comes first.
 */
function waitForDomStable() {
  return new Promise((resolve) => {
    let timer = null
    const QUIET_MS = 200

    const observer = new MutationObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        observer.disconnect()
        resolve()
      }, QUIET_MS)
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    // Start the quiet timer immediately in case no mutations happen
    timer = setTimeout(() => {
      observer.disconnect()
      resolve()
    }, QUIET_MS)

    // Hard cap so we never wait forever
    setTimeout(() => {
      observer.disconnect()
      resolve()
    }, MUTATION_WAIT_MS)
  })
}

function getFieldCount(fields) {
  return Object.values(fields).reduce(
    (total, fieldList) => total + fieldList.length,
    0,
  )
}

function summarizeProfile(profile) {
  return {
    name: Boolean(profile.name),
    email: Boolean(profile.email),
    phone: Boolean(profile.phone),
    linkedin: Boolean(profile.linkedin),
  }
}

// ---------------------------------------------------------------------------
// Retry-aware field detection
// ---------------------------------------------------------------------------

async function detectFieldsWhenReady() {
  let fields = detectFormFields()
  let fieldCount = getFieldCount(fields)

  for (let attempt = 1; fieldCount === 0 && attempt <= FIELD_DETECTION_RETRIES; attempt += 1) {
    console.log('ApplyFlow: No fields detected yet; retrying', {
      attempt,
      href: window.location.href,
      readyState: document.readyState,
    })

    await wait(FIELD_DETECTION_RETRY_MS)
    fields = detectFormFields()
    fieldCount = getFieldCount(fields)
  }

  return { fields, fieldCount }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Detect all form fields on the current page.
 */
function handleDetectFields() {
  try {
    const fields = detectFormFields()
    const fieldsLog = formatFieldsForLogging(fields)
    const fieldCount = getFieldCount(fields)

    console.log('ApplyFlow: Detected form fields:', { fieldCount, fields: fieldsLog })

    return {
      success: true,
      fields: fieldsLog,
      fieldCount,
    }
  } catch (error) {
    console.error('ApplyFlow: Error detecting fields:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Extract metadata (company, role) from the current page.
 */
function handleExtractMetadata() {
  try {
    const metadata = extractPageMetadata()
    console.log('ApplyFlow: Extracted metadata:', metadata)
    return { success: true, metadata }
  } catch (error) {
    console.error('ApplyFlow: Metadata extraction error:', error)
    return { success: false, error: error.message, metadata: { company: '', role: '' } }
  }
}

/**
 * Perform autofill operation with profile data.
 * Prevents concurrent runs via the `isAutofillRunning` guard.
 */
async function handleAutofill() {
  // --- Duplicate guard ---
  if (isAutofillRunning) {
    console.warn('ApplyFlow: Autofill already in progress — skipping duplicate request')
    return {
      success: false,
      error: 'Autofill already in progress',
      duplicate: true,
    }
  }

  isAutofillRunning = true

  try {
    logPageState('Autofill requested')

    await waitForPageReady()

    // Wait for React / dynamic forms to finish rendering
    await waitForDomStable()
    logPageState('DOM stable, proceeding with autofill')

    // Get profile data
    const profile = await getProfileFromStorage()
    console.log('ApplyFlow: Loaded profile summary:', summarizeProfile(profile))

    // Detect fields with retry
    const { fields, fieldCount } = await detectFieldsWhenReady()
    const fieldsLog = formatFieldsForLogging(fields)

    console.log('ApplyFlow: Starting autofill with detected fields:', { fieldCount, fields: fieldsLog })

    // 1. Fill profile-mapped text fields
    const result = autofillFromProfile(profile, fields)

    // 2. Fill select/dropdown fields
    const selectsFilled = autofillSelects(fields.select, profile)

    // 3. Check consent checkboxes
    const checkboxesFilled = autofillCheckboxes(fields.checkbox)

    const totalFilled = result.filledCount + selectsFilled + checkboxesFilled

    // 4. Extract page metadata
    const metadata = extractPageMetadata()

    console.log('ApplyFlow: Autofill completed', {
      profileFields: result.filledCount,
      selects: selectsFilled,
      checkboxes: checkboxesFilled,
      total: totalFilled,
      metadata,
      details: result.details,
    })

    // 5. Record stats
    const outcome = { success: true, filledCount: totalFilled }
    await recordAutofillRun(outcome).catch((err) => {
      console.warn('ApplyFlow: Failed to record autofill stats', err)
    })

    return {
      success: true,
      filledCount: totalFilled,
      message: `Autofilled ${totalFilled} field(s)`,
      metadata,
      details: result.details,
    }
  } catch (error) {
    console.error('ApplyFlow: Autofill error:', error)

    await recordAutofillRun({ success: false, filledCount: 0 }).catch(() => {})

    return {
      success: false,
      error: error.message,
    }
  } finally {
    isAutofillRunning = false
  }
}

// ---------------------------------------------------------------------------
// Message listener (registered once)
// ---------------------------------------------------------------------------

if (!wasContentScriptLoaded) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('ApplyFlow: Received message:', message.action)

    if (message.action === 'detectFields') {
      const result = handleDetectFields()
      sendResponse(result)
    } else if (message.action === 'extractMetadata') {
      const result = handleExtractMetadata()
      sendResponse(result)
    } else if (message.action === 'autofill') {
      handleAutofill()
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }))
      return true // async response
    } else if (message.action === 'ping') {
      sendResponse({
        success: true,
        message: 'Content script is active',
        href: window.location.href,
        readyState: document.readyState,
      })
    }

    return false
  })
}

// ---------------------------------------------------------------------------
// Page load logging
// ---------------------------------------------------------------------------

window.addEventListener('load', () => {
  logPageState('Page fully loaded')
})
