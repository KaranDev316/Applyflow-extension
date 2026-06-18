/**
 * Watches Greenhouse form markup for file upload inputs and autofills resume / cover letter fields.
 */

import { getApplicationFilesFromStorage } from '../storage/fileStorage.js'
import { isResumeField, isCoverLetterField } from './detector.js'
import { uploadResumeToInput, uploadCoverLetterToInput, recreateResumeFile, recreateCoverLetterFile } from './uploader.js'

const AUTO_FILLED_INPUTS = new WeakSet()
let resumeFileAvailable = false
let coverLetterFileAvailable = false
let observer = null

function isGreenhousePage() {
  return /greenhouse\.io/i.test(window.location.hostname)
}

function hasFileInput(node) {
  return node instanceof HTMLInputElement && node.type === 'file'
}

function getFileInputsFromNode(node) {
  if (hasFileInput(node)) {
    return [node]
  }

  if (node instanceof HTMLElement) {
    return Array.from(node.querySelectorAll('input[type="file"]'))
  }

  return []
}

function shouldProcessInput(input) {
  if (!(input instanceof HTMLInputElement) || input.type !== 'file') return false
  if (AUTO_FILLED_INPUTS.has(input)) return false
  if (input.dataset.autofilled === 'true') return false
  if (input.files && input.files.length > 0) return false
  return true
}

async function loadStoredFiles() {
  try {
    const { resumeData, resumeFileName, coverLetterData, coverLetterFileName } = await getApplicationFilesFromStorage()
    resumeFileAvailable = Boolean(resumeData && resumeFileName)
    coverLetterFileAvailable = Boolean(coverLetterData && coverLetterFileName)

    if (resumeFileAvailable) {
      console.log('[Autofill] Resume loaded')
    } else {
      console.warn('[Autofill] Missing resume data in storage')
    }

    if (coverLetterFileAvailable) {
      console.log('[Autofill] Cover letter loaded')
    }

    return { resumeFileAvailable, coverLetterFileAvailable }
  } catch (error) {
    console.warn('[Autofill] Could not load stored application files:', error)
    resumeFileAvailable = false
    coverLetterFileAvailable = false
    return { resumeFileAvailable, coverLetterFileAvailable }
  }
}

async function tryUploadInput(input) {
  if (!shouldProcessInput(input)) return

  if (isResumeField(input)) {
    console.log('[Autofill] Resume field detected')
    if (!resumeFileAvailable) {
      console.warn('[Autofill] Missing resume')
      return
    }

    const success = await uploadResumeToInput(input)
    if (success) {
      AUTO_FILLED_INPUTS.add(input)
    }
    return
  }

  if (isCoverLetterField(input)) {
    console.log('[Autofill] Cover letter field detected')
    if (!coverLetterFileAvailable) {
      console.log('[Autofill] No cover letter available')
      return
    }

    const success = await uploadCoverLetterToInput(input)
    if (success) {
      AUTO_FILLED_INPUTS.add(input)
    }
  }
}

async function scanForResumeAndCoverLetterInputs(root = document) {
  const fileInputs = Array.from(root.querySelectorAll('input[type="file"]'))
  await Promise.all(fileInputs.map(async (input) => tryUploadInput(input)))
}

function handleMutations(mutations) {
  for (const mutation of mutations) {
    if (mutation.type !== 'childList' && mutation.type !== 'attributes') continue

    const nodes = [...mutation.addedNodes]
    if (mutation.target instanceof HTMLInputElement && mutation.target.type === 'file') {
      nodes.push(mutation.target)
    }

    nodes.forEach((node) => {
      const inputs = getFileInputsFromNode(node)
      inputs.forEach((input) => {
        tryUploadInput(input)
      })
    })
  }
}

function scheduleScan() {
  if (observer) {
    scanForResumeAndCoverLetterInputs().catch((error) => {
      console.warn('[Autofill] Error scanning for file inputs:', error)
    })
  }
}

function patchHistoryAPI() {
  if (window.__applyflow_history_patched__) return

  const pushState = window.history.pushState
  const replaceState = window.history.replaceState

  window.history.pushState = function (...args) {
    const result = pushState.apply(this, args)
    window.dispatchEvent(new Event('locationchange'))
    return result
  }

  window.history.replaceState = function (...args) {
    const result = replaceState.apply(this, args)
    window.dispatchEvent(new Event('locationchange'))
    return result
  }

  window.addEventListener('popstate', () => {
    window.dispatchEvent(new Event('locationchange'))
  })

  window.__applyflow_history_patched__ = true
}

async function handleStorageChange(changes) {
  const watchedKeys = ['resumeData', 'resumeFileName', 'coverLetterData', 'coverLetterFileName']
  const hasRelevantChange = Object.keys(changes).some((key) => watchedKeys.includes(key))

  if (!hasRelevantChange) return

  await loadStoredFiles()
  scheduleScan()
}

export async function startGreenhouseUploadObserver() {
  if (!isGreenhousePage()) return

  await loadStoredFiles()

  try {
    await scanForResumeAndCoverLetterInputs()
  } catch (error) {
    console.warn('[Autofill] Initial Greenhouse scan failed:', error)
  }

  if (!observer) {
    observer = new MutationObserver(handleMutations)
    observer.observe(document.documentElement || document.body || document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'type', 'name', 'id', 'aria-label'],
    })
  }

  patchHistoryAPI()

  chrome.storage.onChanged.addListener((changes) => {
    handleStorageChange(changes).catch((error) => {
      console.warn('[Autofill] Storage change handler failed:', error)
    })
  })
}
