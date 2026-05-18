/**
 * Content script for ApplyFlow Chrome extension
 * Runs on Greenhouse and Lever application pages
 * Handles field detection and autofill operations
 */

import { detectFormFields, formatFieldsForLogging } from './utils/fieldDetection.js'
import { getProfileFromStorage } from './utils/storageUtil.js'

console.log('ApplyFlow content script loaded')

const PAGE_READY_DELAY_MS = 250

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

function setNativeFieldValue(field, value) {
  const prototype = field instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set

  if (valueSetter) {
    valueSetter.call(field, value)
  } else {
    field.value = value
  }

  field.dispatchEvent(new Event('input', { bubbles: true }))
  field.dispatchEvent(new Event('change', { bubbles: true }))
}

function fillFirstField(fieldType, fields, value) {
  if (!value || fields[fieldType].length === 0) {
    return 0
  }

  const field = fields[fieldType][0].element

  if (!field?.isConnected) {
    logPageState(`Skipped disconnected ${fieldType} field`)
    return 0
  }

  logPageState(`Filling ${fieldType} field`, {
    id: field.id || '',
    name: field.name || '',
    type: field.type || field.tagName.toLowerCase(),
  })

  setNativeFieldValue(field, value)
  return 1
}

/**
 * Detect all form fields on the current page
 */
function handleDetectFields() {
  try {
    const fields = detectFormFields()
    const fieldsLog = formatFieldsForLogging(fields)

    console.log('ApplyFlow: Detected form fields:', fieldsLog)

    return {
      success: true,
      fields: fieldsLog,
      fieldCount: Object.values(fields).reduce((total, fieldList) => total + fieldList.length, 0),
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
 * Perform autofill operation with profile data
 */
async function handleAutofill() {
  try {
    await waitForPageReady()

    // Get profile data from storage
    const profile = await getProfileFromStorage()

    // Detect form fields
    const fields = detectFormFields()

    console.log('ApplyFlow: Starting autofill with profile:', {
      name: profile.name ? '***' : '',
      email: profile.email ? '***' : '',
    })

    let filledCount = 0

    filledCount += fillFirstField('name', fields, profile.name)
    filledCount += fillFirstField('email', fields, profile.email)
    filledCount += fillFirstField('linkedin', fields, profile.linkedin)

    console.log(`ApplyFlow: Autofill completed - filled ${filledCount} fields`)

    return {
      success: true,
      filledCount,
      message: `Autofilled ${filledCount} field(s)`,
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
    sendResponse({ success: true, message: 'Content script is active' })
  }
})

/**
 * Avoid touching the host page's React-controlled form during its hydration.
 * Field detection now runs only when the popup explicitly asks for it.
 */
window.addEventListener('load', () => {
  logPageState('Page fully loaded')
})
