import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import {
  emptyProfile,
  getProfile,
  getProfileOrEmpty,
  saveProfile,
  validateProfile,
} from '../src/storage/profileStorage.js'

let backingStore
let nextStorageError

function installChromeStorageMock() {
  backingStore = {}
  nextStorageError = null

  globalThis.chrome = {
    runtime: {
      lastError: null,
    },
    storage: {
      local: {
        get(key, callback) {
          globalThis.chrome.runtime.lastError = nextStorageError
          nextStorageError = null

          if (Array.isArray(key)) {
            callback(Object.fromEntries(key.map((itemKey) => [itemKey, backingStore[itemKey]])))
            return
          }

          callback({ [key]: backingStore[key] })
        },
        set(values, callback) {
          globalThis.chrome.runtime.lastError = nextStorageError
          nextStorageError = null

          if (!globalThis.chrome.runtime.lastError) {
            backingStore = {
              ...backingStore,
              ...values,
            }
          }

          callback()
        },
      },
    },
  }
}

beforeEach(() => {
  installChromeStorageMock()
})

test('saving profile persists after browser restart', async () => {
  const profile = {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '555-0101',
    linkedin: 'https://linkedin.com/in/ada',
  }

  await saveProfile(profile)

  const restartedSessionStore = backingStore
  installChromeStorageMock()
  backingStore = restartedSessionStore

  assert.deepEqual(await getProfile(), profile)
})

test('empty required fields show validation errors', () => {
  assert.deepEqual(validateProfile({
    name: '',
    email: '',
    phone: '',
    linkedin: '',
  }), {
    name: 'This field is required',
    email: 'This field is required',
  })
})

test('editing profile updates stored values', async () => {
  await saveProfile({
    name: 'Grace Hopper',
    email: 'grace@example.com',
    phone: '555-0102',
    linkedin: 'https://linkedin.com/in/grace',
  })

  await saveProfile({
    name: 'Grace Brewster Hopper',
    email: 'grace.hopper@example.com',
    phone: '555-0103',
    linkedin: 'https://www.linkedin.com/in/grace-hopper',
  })

  assert.deepEqual(await getProfile(), {
    name: 'Grace Brewster Hopper',
    email: 'grace.hopper@example.com',
    phone: '555-0103',
    linkedin: 'https://www.linkedin.com/in/grace-hopper',
  })
})

test('invalid URLs are handled properly', async () => {
  const invalidProfile = {
    name: 'Katherine Johnson',
    email: 'katherine@example.com',
    phone: '555-0104',
    linkedin: 'not-a-url',
  }

  assert.deepEqual(validateProfile(invalidProfile), {
    linkedin: 'Enter a valid URL',
  })

  await assert.rejects(
    () => saveProfile(invalidProfile),
    (error) => {
      assert.equal(error.message, 'Profile validation failed')
      assert.deepEqual(error.validationErrors, {
        linkedin: 'Enter a valid URL',
      })
      return true
    },
  )

  assert.deepEqual(await getProfile(), emptyProfile)
})

test('storage retrieval failure is handled gracefully', async () => {
  nextStorageError = { message: 'Storage is unavailable' }

  const result = await getProfileOrEmpty()

  assert.deepEqual(result.profile, emptyProfile)
  assert.equal(result.error.message, 'Storage is unavailable')
})
