/**
 * File storage helpers for resume and cover letter data.
 * Stored in chrome.storage.local as raw base64/data URL strings.
 */

const STORAGE_KEYS = {
  resumeData: 'resumeData',
  resumeFileName: 'resumeFileName',
  coverLetterData: 'coverLetterData',
  coverLetterFileName: 'coverLetterFileName',
}

function normalizeString(value) {
  return typeof value === 'string' ? value : ''
}

function createStoragePayload(payload) {
  return {
    [STORAGE_KEYS.resumeData]: normalizeString(payload.resumeData),
    [STORAGE_KEYS.resumeFileName]: normalizeString(payload.resumeFileName),
    [STORAGE_KEYS.coverLetterData]: normalizeString(payload.coverLetterData),
    [STORAGE_KEYS.coverLetterFileName]: normalizeString(payload.coverLetterFileName),
  }
}

export async function getApplicationFilesFromStorage() {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(Object.values(STORAGE_KEYS), (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }

        resolve({
          resumeData: normalizeString(result[STORAGE_KEYS.resumeData]),
          resumeFileName: normalizeString(result[STORAGE_KEYS.resumeFileName]),
          coverLetterData: normalizeString(result[STORAGE_KEYS.coverLetterData]),
          coverLetterFileName: normalizeString(result[STORAGE_KEYS.coverLetterFileName]),
        })
      })
    } catch (error) {
      reject(error)
    }
  })
}

export async function saveApplicationFilesToStorage(files) {
  return new Promise((resolve, reject) => {
    try {
      const payload = createStoragePayload(files)
      chrome.storage.local.set(payload, () => {
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

export async function clearApplicationFilesFromStorage() {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.remove(Object.values(STORAGE_KEYS), () => {
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
