/**
 * Utility functions for reading and writing data from chrome.storage.local
 */

/**
 * Get profile data from chrome.storage.local
 * @returns {Promise<object>} Profile object { name, email, linkedin }
 */
export async function getProfileFromStorage() {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(['profile'], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          const profile = result.profile || { name: '', email: '', linkedin: '' }
          resolve(profile)
        }
      })
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Save profile data to chrome.storage.local
 * @param {object} profile - Profile object { name, email, linkedin }
 * @returns {Promise<void>}
 */
export async function saveProfileToStorage(profile) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set({ profile }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve()
        }
      })
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Clear profile data from chrome.storage.local
 * @returns {Promise<void>}
 */
export async function clearProfileFromStorage() {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.remove(['profile'], () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve()
        }
      })
    } catch (error) {
      reject(error)
    }
  })
}
