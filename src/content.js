/**
 * Content script for ApplyFlow Chrome extension
 * Runs on Greenhouse and Lever application pages
 * Handles field detection and autofill operations
 */

import { detectFormFields, formatFieldsForLogging } from './utils/fieldDetection.js'
import { getProfileFromStorage } from './utils/storageUtil.js'
import {
  autofillFromProfile,
  autofillCheckboxes,
  autofillSelects,
} from './utils/autofillEngine.js'

const wasContentScriptLoaded = globalThis.__APPLYFLOW_CONTENT_SCRIPT_LOADED__ === true

if (wasContentScriptLoaded) {
  console.log('ApplyFlow content script already loaded; skipping duplicate listener')
} else {
  globalThis.__APPLYFLOW_CONTENT_SCRIPT_LOADED__ = true
  console.log('ApplyFlow content script loaded')
}

const PAGE_READY_DELAY_MS = 250
const FIELD_DETECTION_RETRIES = 10
const FIELD_DETECTION_RETRY_MS = 250

function logPageState(eventName, extra = {}) {
  console.log('ApplyFlow:', eventName, {
    href: window.location.href,
    readyState: document.readyState,
    time: Math.round(performance.now()),
    ...extra,
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

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

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

/**
 * Detect all form fields on the current page
 */
function handleDetectFields() {
  try {
    const fields = detectFormFields()
    const fieldsLog = formatFieldsForLogging(fields)
    const fieldCount = getFieldCount(fields)

    console.log('ApplyFlow: Detected form fields:', {
      fieldCount,
      fields: fieldsLog,
    })

    return {
      success: true,
      fields: fieldsLog,
      fieldCount,
    }
  } catch (error) {
    console.error('ApplyFlow: Error detecting fields:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Perform autofill operation with profile data using the autofill engine.
 */
async function handleAutofill() {
  try {
    logPageState('Autofill requested')

    await waitForPageReady()
    logPageState('Page ready for autofill')

    // Get profile data from storage
    const profile = await getProfileFromStorage()
    console.log('ApplyFlow: Loaded profile summary:', summarizeProfile(profile))

    // Detect form fields
    const { fields, fieldCount } = await detectFieldsWhenReady()
    const fieldsLog = formatFieldsForLogging(fields)

    console.log('ApplyFlow: Starting autofill with detected fields:', {
      fieldCount,
      fields: fieldsLog,
    })

    // 1. Fill profile-mapped text fields (name, email, phone, linkedin)
    const result = autofillFromProfile(profile, fields)

    // 2. Try to fill relevant select/dropdown fields
    const selectsFilled = autofillSelects(fields.select, profile)

    // 3. Check consent/agreement checkboxes
    const checkboxesFilled = autofillCheckboxes(fields.checkbox)

    const totalFilled = result.filledCount + selectsFilled + checkboxesFilled

    console.log('ApplyFlow: Autofill completed', {
      profileFields: result.filledCount,
      selects: selectsFilled,
      checkboxes: checkboxesFilled,
      total: totalFilled,
      details: result.details,
    })

    return {
      success: true,
      filledCount: totalFilled,
      message: `Autofilled ${totalFilled} field(s)`,
    }
  } catch (error) {
    console.error('ApplyFlow: Autofill error:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Set up message listener for communication with popup
 */
if (!wasContentScriptLoaded) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('ApplyFlow: Received message:', message.action)

    if (message.action === 'detectFields') {
      const result = handleDetectFields()
      sendResponse(result)
    } else if (message.action === 'autofill') {
      handleAutofill()
        .then((result) => {
          sendResponse(result)
        })
        .catch((error) => {
          sendResponse({
            success: false,
            error: error.message,
          })
        })
      // Return true to indicate we'll send response asynchronously
      return true
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

/**
 * Avoid touching the host page's React-controlled form during its hydration.
 * Field detection now runs only when the popup explicitly asks for it.
 */
window.addEventListener('load', () => {
  logPageState('Page fully loaded')
})
