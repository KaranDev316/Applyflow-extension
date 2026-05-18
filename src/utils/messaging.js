/**
 * Utility functions for message passing between popup and content scripts
 */

/**
 * Send a message to the content script on the active tab
 * @param {string} action - The action to perform (e.g., 'autofill', 'detectFields')
 * @param {object} data - Additional data to send with the message
 * @returns {Promise<object>} Response from content script
 */
export async function sendMessageToContentScript(action, data = {}) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    if (!tab) {
      throw new Error('No active tab found')
    }

    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tab.id,
        {
          action,
          ...data,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else if (response && response.success === false) {
            reject(new Error(response.error || 'Content script error'))
          } else {
            resolve(response)
          }
        },
      )
    })
  } catch (error) {
    console.error('Failed to send message to content script:', error)
    throw error
  }
}

/**
 * Detect fields on the current page via content script
 * @returns {Promise<object>} Detected fields
 */
export async function detectFieldsOnPage() {
  try {
    const response = await sendMessageToContentScript('detectFields')
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
    const response = await sendMessageToContentScript('autofill')
    return response
  } catch (error) {
    console.error('Failed to trigger autofill:', error)
    throw error
  }
}

/**
 * Verify content script is active
 * @returns {Promise<boolean>} True if content script is active
 */
export async function isContentScriptActive() {
  try {
    const response = await sendMessageToContentScript('ping')
    return response && response.success
  } catch (error) {
    return false
  }
}
