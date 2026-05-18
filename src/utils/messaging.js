/**
 * Utility functions for message passing between popup and content scripts
 */

import { MESSAGE_ACTIONS } from '../types/messages'

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  if (!tab?.id) {
    throw new Error('No active tab found')
  }

  return tab
}

function getContentScriptFiles() {
  return chrome.runtime
    .getManifest()
    .content_scripts
    ?.flatMap((contentScript) => contentScript.js || [])
    || []
}

function isMissingReceiverError(error) {
  return /receiving end does not exist|could not establish connection|no response/i.test(
    error.message,
  )
}

function sendTabMessage(tabId, action, data = {}) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      {
        action,
        ...data,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else if (response && response.success === false) {
          reject(new Error(response.error || 'Content script error'))
        } else if (!response) {
          reject(new Error('No response from content script'))
        } else {
          resolve(response)
        }
      },
    )
  })
}

/**
 * Send a message to the content script on the active tab
 * @param {string} action - The action to perform (e.g., 'autofill', 'detectFields')
 * @param {object} data - Additional data to send with the message
 * @returns {Promise<object>} Response from content script
 */
export async function sendMessageToContentScript(action, data = {}) {
  try {
    const tab = await getActiveTab()

    console.log('ApplyFlow popup: Sending message to content script', {
      action,
      tabId: tab.id,
      url: tab.url,
    })

    try {
      return await sendTabMessage(tab.id, action, data)
    } catch (error) {
      if (!isMissingReceiverError(error)) {
        throw error
      }

      console.warn('ApplyFlow popup: Content script missing; injecting fallback', {
        action,
        error: error.message,
      })

      await injectContentScriptIntoActiveTab(tab)
      return sendTabMessage(tab.id, action, data)
    }
  } catch (error) {
    console.error('Failed to send message to content script:', error)
    throw error
  }
}

/**
 * Programmatically inject the declared content script into the active tab.
 * This recovers tabs that were already open when the extension was loaded.
 */
export async function injectContentScriptIntoActiveTab(activeTab) {
  const tab = activeTab || await getActiveTab()
  const files = getContentScriptFiles()

  if (files.length === 0) {
    throw new Error('No content script files are declared in the manifest')
  }

  console.log('ApplyFlow popup: Injecting content script into active tab', {
    tabId: tab.id,
    url: tab.url,
    files,
  })

  await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    files,
  })
}

/**
 * Detect fields on the current page via content script
 * @returns {Promise<object>} Detected fields
 */
export async function detectFieldsOnPage() {
  try {
    const response = await sendMessageToContentScript(MESSAGE_ACTIONS.DETECT_FIELDS)
    return response
  } catch (error) {
    console.error('Failed to detect fields:', error)
    throw error
  }
}

/**
 * Trigger autofill on the current page via content script
 * @returns {Promise<object>} Autofill result
 */
export async function triggerAutofillOnPage() {
  try {
    const response = await sendMessageToContentScript(MESSAGE_ACTIONS.AUTOFILL)
    return response
  } catch (error) {
    console.error('Failed to trigger autofill:', error)
    throw error
  }
}

/**
 * Extract page metadata (company name, role title) via content script
 * @returns {Promise<object>} Metadata result { success, metadata: { company, role } }
 */
export async function extractMetadataFromPage() {
  try {
    const response = await sendMessageToContentScript(MESSAGE_ACTIONS.EXTRACT_METADATA)
    return response
  } catch (error) {
    console.error('Failed to extract metadata:', error)
    return { success: false, metadata: { company: '', role: '' } }
  }
}

/**
 * Verify content script is active, injecting it if Chrome has not loaded it.
 * @returns {Promise<boolean>} True if content script is active
 */
export async function isContentScriptActive() {
  try {
    const response = await sendMessageToContentScript(MESSAGE_ACTIONS.PING)
    return response && response.success
  } catch (error) {
    console.warn('ApplyFlow popup: Content script ping failed:', error.message)
    return false
  }
}
