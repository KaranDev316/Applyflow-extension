/**
 * Content script for ApplyFlow Chrome extension
 * Runs on Greenhouse and Lever application pages
 * Handles field detection and autofill operations
 */

import { detectFormFields, formatFieldsForLogging } from './utils/fieldDetection.js'
import { getProfileFromStorage } from './utils/storageUtil.js'

console.log('ApplyFlow content script loaded')

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
    // Get profile data from storage
    const profile = await getProfileFromStorage()

    // Detect form fields
    const fields = detectFormFields()

    console.log('ApplyFlow: Starting autofill with profile:', {
      name: profile.name ? '***' : '',
      email: profile.email ? '***' : '',
    })

    let filledCount = 0

    // Fill name field
    if (profile.name && fields.name.length > 0) {
      const nameField = fields.name[0].element
      nameField.value = profile.name
      nameField.dispatchEvent(new Event('input', { bubbles: true }))
      nameField.dispatchEvent(new Event('change', { bubbles: true }))
      filledCount++
      console.log('ApplyFlow: Filled name field')
    }

    // Fill email field
    if (profile.email && fields.email.length > 0) {
      const emailField = fields.email[0].element
      emailField.value = profile.email
      emailField.dispatchEvent(new Event('input', { bubbles: true }))
      emailField.dispatchEvent(new Event('change', { bubbles: true }))
      filledCount++
      console.log('ApplyFlow: Filled email field')
    }

    // Fill LinkedIn field
    if (profile.linkedin && fields.linkedin.length > 0) {
      const linkedinField = fields.linkedin[0].element
      linkedinField.value = profile.linkedin
      linkedinField.dispatchEvent(new Event('input', { bubbles: true }))
      linkedinField.dispatchEvent(new Event('change', { bubbles: true }))
      filledCount++
      console.log('ApplyFlow: Filled LinkedIn field')
    }

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
 * Log detected fields on page load
 */
window.addEventListener('load', () => {
  console.log('ApplyFlow: Page fully loaded, detecting fields...')
  handleDetectFields()
})
