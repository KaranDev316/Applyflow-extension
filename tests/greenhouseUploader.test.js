import assert from 'node:assert'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { recreateResumeFile, recreateCoverLetterFile } from '../src/greenhouse/uploader.js'
import { saveApplicationFilesToStorage, clearApplicationFilesFromStorage } from '../src/storage/fileStorage.js'

const dataUrl = 'data:application/pdf;base64,JVBERi0xLjQKJSVFT0YK'
const plainBase64 = 'JVBERi0xLjQKJSVFT0YK'
const stubFileName = 'test-document.pdf'

function createMockChromeStorage() {
  const storage = new Map()
  return {
    storage: {
      local: {
        get(keys, callback) {
          const result = {}
          keys.forEach((key) => {
            result[key] = storage.has(key) ? storage.get(key) : undefined
          })
          callback(result)
        },
        set(payload, callback) {
          Object.entries(payload).forEach(([key, value]) => {
            storage.set(key, value)
          })
          if (typeof callback === 'function') callback()
        },
        remove(keys, callback) {
          keys.forEach((key) => storage.delete(key))
          if (typeof callback === 'function') callback()
        },
      },
    },
    runtime: {
      lastError: null,
    },
  }
}

test('recreates a resume File from stored data URL', async () => {
  const dom = new JSDOM(`<!DOCTYPE html><body></body>`)
  global.document = dom.window.document
  global.window = dom.window
  global.File = dom.window.File
  global.chrome = createMockChromeStorage()

  await saveApplicationFilesToStorage({ resumeData: dataUrl, resumeFileName: stubFileName })
  const file = await recreateResumeFile()
  assert.ok(file instanceof dom.window.File)
  assert.strictEqual(file.name, stubFileName)
  assert.strictEqual(file.type, 'application/pdf')
  await clearApplicationFilesFromStorage()
})

test('recreates a cover letter File from stored base64 string', async () => {
  const dom = new JSDOM(`<!DOCTYPE html><body></body>`)
  global.document = dom.window.document
  global.window = dom.window
  global.File = dom.window.File
  global.chrome = createMockChromeStorage()

  await saveApplicationFilesToStorage({ coverLetterData: plainBase64, coverLetterFileName: stubFileName })
  const file = await recreateCoverLetterFile()
  assert.ok(file instanceof dom.window.File)
  assert.strictEqual(file.name, stubFileName)
  assert.strictEqual(file.type, 'application/pdf')
  await clearApplicationFilesFromStorage()
})
