/**
 * Helpers for reconstructing stored PDF blobs and uploading them to input elements.
 */

import { getApplicationFilesFromStorage } from '../storage/fileStorage.js'

function base64ToUint8Array(base64) {
  const binaryString = typeof atob === 'function'
    ? atob(base64)
    : Buffer.from(base64, 'base64').toString('binary')

  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

function parseStoredFileData(storedData) {
  if (typeof storedData !== 'string' || !storedData.trim()) return null

  const dataUrlMatch = storedData.match(/^data:([^;]+);base64,(.+)$/i)
  if (dataUrlMatch) {
    return {
      mimeType: dataUrlMatch[1] || 'application/pdf',
      buffer: base64ToUint8Array(dataUrlMatch[2]),
    }
  }

  return {
    mimeType: 'application/pdf',
    buffer: base64ToUint8Array(storedData.trim()),
  }
}

function createFileFromStoredData(storedData, fileName) {
  const parsed = parseStoredFileData(storedData)
  if (!parsed || !fileName) return null

  try {
    return new File([parsed.buffer], fileName, { type: parsed.mimeType })
  } catch (error) {
    console.warn('[Autofill] Failed to create File object:', error)
    return null
  }
}

function createDataTransferWithFile(file) {
  const dataTransfer = new DataTransfer()
  dataTransfer.items.add(file)
  return dataTransfer
}

function setFileInputFiles(input, file) {
  const dataTransfer = createDataTransferWithFile(file)

  // Use the native setter to safely bypass React's internal state hijacking
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'files'
  )?.set

  try {
    if (nativeSetter) {
      nativeSetter.call(input, dataTransfer.files)
    } else {
      input.files = dataTransfer.files
    }
  } catch (error) {
    Object.defineProperty(input, 'files', {
      value: dataTransfer.files,
      writable: false,
    })
  }
}

function dispatchInputEvents(input) {
  const eventOptions = { bubbles: true, cancelable: true }
  // Native file selects typically only fire 'change'. Firing 'input' can crash some uploaders.
  input.dispatchEvent(new Event('change', eventOptions))
}

export async function recreateResumeFile() {
  const { resumeData, resumeFileName } = await getApplicationFilesFromStorage()
  return createFileFromStoredData(resumeData, resumeFileName)
}

export async function recreateCoverLetterFile() {
  const { coverLetterData, coverLetterFileName } = await getApplicationFilesFromStorage()
  return createFileFromStoredData(coverLetterData, coverLetterFileName)
}

function uploadFileToInput(input, file, fieldType) {
  if (!input || input.tagName !== 'INPUT' || input.type !== 'file') return false
  if (!file) return false
  if (input.dataset.autofilled === 'true') {
    console.log('[Autofill] Upload skipped')
    return false
  }

  if (input.files && input.files.length > 0) {
    console.log('[Autofill] Upload skipped')
    return false
  }

  setFileInputFiles(input, file)
  dispatchInputEvents(input)
  input.dataset.autofilled = 'true'
  input.dataset.autofilledType = fieldType
  return true
}

export async function uploadResumeToInput(input) {
  const resumeFile = await recreateResumeFile()
  if (!resumeFile) {
    console.warn('[Autofill] Missing resume data or filename')
    return false
  }

  const success = uploadFileToInput(input, resumeFile, 'resume')
  if (success) {
    console.log('[Autofill] Resume uploaded successfully')
  }
  return success
}

export async function uploadCoverLetterToInput(input) {
  const coverLetterFile = await recreateCoverLetterFile()
  if (!coverLetterFile) {
    console.log('[Autofill] No cover letter available')
    return false
  }

  const success = uploadFileToInput(input, coverLetterFile, 'coverLetter')
  if (success) {
    console.log('[Autofill] Cover letter uploaded successfully')
  }
  return success
}
