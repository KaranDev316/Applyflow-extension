export const emptyProfile = {
  name: '',
  email: '',
  phone: '',
  linkedin: '',
}

const requiredFields = ['name', 'email']
const urlFields = ['linkedin']

function getStorageArea() {
  return globalThis.chrome?.storage?.local
}

function getLastError() {
  return globalThis.chrome?.runtime?.lastError
}

function normalizeProfile(profile = {}) {
  return {
    name: profile.name?.trim() ?? '',
    email: profile.email?.trim() ?? '',
    phone: profile.phone?.trim() ?? '',
    linkedin: profile.linkedin?.trim() ?? '',
  }
}

function isValidUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function validateProfile(profile = {}) {
  const normalizedProfile = normalizeProfile(profile)
  const errors = {}

  requiredFields.forEach((fieldName) => {
    if (!normalizedProfile[fieldName]) {
      errors[fieldName] = 'This field is required'
    }
  })

  urlFields.forEach((fieldName) => {
    if (normalizedProfile[fieldName] && !isValidUrl(normalizedProfile[fieldName])) {
      errors[fieldName] = 'Enter a valid URL'
    }
  })

  return errors
}

export function hasProfileValidationErrors(profile = {}) {
  return Object.keys(validateProfile(profile)).length > 0
}

export async function getProfile() {
  const storage = getStorageArea()

  if (!storage) {
    return emptyProfile
  }

  return new Promise((resolve, reject) => {
    storage.get('profile', (result) => {
      const error = getLastError()

      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(normalizeProfile(result.profile))
    })
  })
}

export async function getProfileOrEmpty() {
  try {
    return {
      error: null,
      profile: await getProfile(),
    }
  } catch (error) {
    return {
      error,
      profile: emptyProfile,
    }
  }
}

export async function saveProfile(profile) {
  const storage = getStorageArea()

  if (!storage) {
    throw new Error('chrome.storage.local is unavailable')
  }

  const validationErrors = validateProfile(profile)

  if (Object.keys(validationErrors).length > 0) {
    const error = new Error('Profile validation failed')
    error.validationErrors = validationErrors
    throw error
  }

  return new Promise((resolve, reject) => {
    storage.set({ profile: normalizeProfile(profile) }, () => {
      const error = getLastError()

      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve()
    })
  })
}
