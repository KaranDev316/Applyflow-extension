/**
 * Utility functions for message passing between popup and content scripts
 */

import { MESSAGE_ACTIONS } from '../types/messages'

const responsiveFrameIdsByTab = new Map()

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
  const msg = typeof error === 'string' ? error : error?.message || ''
  return /receiving end does not exist|could not establish connection|no response/i.test(
    msg,
  )
}

function sendTabMessage(tabId, action, data = {}, options = {}) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      {
        action,
        ...data,
      },
      options,
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

async function sendMessageToAnyFrame(tab, action, data = {}, preferredFrameIds = []) {
  const cachedFrameIds = responsiveFrameIdsByTab.get(tab.id) || []
  const frameIds = [...new Set([...cachedFrameIds, 0, ...preferredFrameIds])]
  let lastError = null

  for (const frameId of frameIds) {
    try {
      const response = await sendTabMessage(tab.id, action, data, { frameId })
      responsiveFrameIdsByTab.set(tab.id, [frameId])
      console.log('ApplyFlow popup: Content script responded', {
        action,
        tabId: tab.id,
        frameId,
      })
      return response
    } catch (error) {
      lastError = error
      console.warn('ApplyFlow popup: Content script frame did not respond', {
        action,
        tabId: tab.id,
        frameId,
        error: error.message || error,
      })

      if (!isMissingReceiverError(error)) {
        throw error
      }
    }
  }

  throw lastError || new Error('No content script frame responded')
}

async function getAccessibleFrameIds(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => true,
    })

    return results
      .map((result) => result.frameId)
      .filter((frameId) => Number.isInteger(frameId))
  } catch (error) {
    console.warn('ApplyFlow popup: Failed to probe accessible frames', {
      tabId,
      error: error.message,
    })
    return [0]
  }
}

async function injectContentScriptIntoFrame(tabId, frameId, files) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      files,
    })
    return true
  } catch (error) {
    console.warn('ApplyFlow popup: Content script injection failed for frame', {
      tabId,
      frameId,
      error: error.message,
    })
    return false
  }
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
      return await sendMessageToAnyFrame(tab, action, data)
    } catch (error) {
      if (!isMissingReceiverError(error)) {
        throw error
      }

      console.warn('ApplyFlow popup: Content script missing; injecting fallback', {
        action,
        error: error.message,
      })

      const injectedFrameIds = await injectContentScriptIntoActiveTab(tab)
      
      // Retry to allow async initialization (e.g., Vite dynamic imports) to complete
      let retries = 5
      while (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 200))
        try {
          return await sendMessageToAnyFrame(tab, action, data, injectedFrameIds)
        } catch (err) {
          if (retries === 1 || !isMissingReceiverError(err)) throw err
          retries--
        }
      }
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

  const accessibleFrameIds = await getAccessibleFrameIds(tab.id)
  const injectedFrameIds = []

  for (const frameId of accessibleFrameIds) {
    const injected = await injectContentScriptIntoFrame(tab.id, frameId, files)
    if (injected) {
      injectedFrameIds.push(frameId)
    }
  }

  console.log('ApplyFlow popup: Content script injection completed', {
    tabId: tab.id,
    accessibleFrameIds,
    injectedFrameIds,
  })

  return injectedFrameIds.length > 0 ? injectedFrameIds : accessibleFrameIds
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
    const tab = await getActiveTab()
    console.log('ApplyFlow popup: Checking content script status', {
      tabId: tab.id,
      url: tab.url,
    })

    const response = await sendMessageToContentScript(MESSAGE_ACTIONS.PING)
    return response && response.success
  } catch (error) {
    console.warn('ApplyFlow popup: Content script ping failed:', {
      name: error.name,
      message: error.message,
    })
    return false
  }
}
