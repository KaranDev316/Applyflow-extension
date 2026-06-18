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

const migratedAdaProfile = {
  personal: {
    firstName: 'Ada',
    lastName: 'Lovelace',
    preferredFirstName: '',
    email: 'ada@example.com',
    phone: '555-0101',
  },
  location: {
    address: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
  },
  documents: {
    resume: '',
    coverLetter: '',
  },
  professional: {
    currentCompany: '',
    experienceYears: '',
    skills: [],
  },
  social: {
    linkedin: 'https://linkedin.com/in/ada',
    github: '',
    portfolio: '',
    website: '',
  },
  application: {
    motivationStatement: '',
  },
}

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

  assert.deepEqual(await getProfile(), migratedAdaProfile)
})

test('old flat profile data migrates to nested profile shape', async () => {
  backingStore.profile = {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '1234567890',
    linkedin: 'https://linkedin.com/in/john',
  }

  assert.deepEqual(await getProfile(), {
    ...emptyProfile,
    personal: {
      ...emptyProfile.personal,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '1234567890',
    },
    social: {
      ...emptyProfile.social,
      linkedin: 'https://linkedin.com/in/john',
    },
  })
})

test('empty required fields show validation errors', () => {
  assert.deepEqual(validateProfile({
    personal: {
      firstName: '',
      lastName: '',
      email: '',
    },
  }), {
    'personal.firstName': 'This field is required',
    'personal.lastName': 'This field is required',
    'personal.email': 'This field is required',
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
    ...emptyProfile,
    personal: {
      ...emptyProfile.personal,
      firstName: 'Grace',
      lastName: 'Brewster Hopper',
      email: 'grace.hopper@example.com',
      phone: '555-0103',
    },
    social: {
      ...emptyProfile.social,
      linkedin: 'https://www.linkedin.com/in/grace-hopper',
    },
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
    'social.linkedin': 'Enter a valid URL',
  })

  await assert.rejects(
    () => saveProfile(invalidProfile),
    (error) => {
      assert.equal(error.message, 'Profile validation failed')
      assert.deepEqual(error.validationErrors, {
        'social.linkedin': 'Enter a valid URL',
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
