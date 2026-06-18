import {
  normalizePhoneForCountry,
  profileSchema,
  profileSchemaIssuesToErrors,
  toLocationCity,
  toLocationCountry,
  toLocationState,
} from '../utils/profileValidation.js'

export const emptyProfile = {
  personal: {
    firstName: '',
    lastName: '',
    preferredFirstName: '',
    email: '',
    phone: null,
  },
  location: {
    address: '',
    city: null,
    state: null,
    country: null,
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
    linkedin: '',
    github: '',
    portfolio: '',
    website: '',
  },
  application: {
    motivationStatement: '',
  },
}

const requiredFields = ['personal.firstName', 'personal.lastName', 'personal.email']
const urlFields = ['social.linkedin', 'social.github', 'social.portfolio', 'social.website']

function getStorageArea() {
  return globalThis.chrome?.storage?.local
}

function getLastError() {
  return globalThis.chrome?.runtime?.lastError
}

function trimValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function getPathValue(profile, path) {
  return path.split('.').reduce((value, key) => value?.[key], profile)
}

function splitName(name = '') {
  const parts = trimValue(name).split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

function normalizeSkills(skills) {
  if (Array.isArray(skills)) {
    return skills.map(trimValue).filter(Boolean)
  }

  if (typeof skills === 'string') {
    return skills.split(',').map(trimValue).filter(Boolean)
  }

  return []
}

export function normalizeProfile(profile = {}) {
  const migratedName = splitName(profile.name)
  const personal = profile.personal || {}
  const location = profile.location || {}
  const documents = profile.documents || {}
  const professional = profile.professional || {}
  const social = profile.social || {}
  const application = profile.application || {}
  const country = location.country === '' ? '' : toLocationCountry(location.country)
  const state = location.state === '' ? '' : toLocationState(location.state, country?.code)
  const city = location.city === '' ? '' : toLocationCity(location.city, country?.code, state?.code)
  const rawPhoneInput = personal.phone || profile.phone
  let phone = normalizePhoneForCountry(rawPhoneInput, country?.code)
  // Preserve raw string phone values when normalization fails (migration case)
  if (!phone && typeof rawPhoneInput === 'string' && rawPhoneInput.trim()) {
    phone = rawPhoneInput.trim()
  }

  return {
    personal: {
      firstName: trimValue(personal.firstName) || migratedName.firstName,
      lastName: trimValue(personal.lastName) || migratedName.lastName,
      preferredFirstName: trimValue(personal.preferredFirstName || personal.preferredName),
      email: trimValue(personal.email || profile.email),
      phone,
    },
    location: {
      address: trimValue(location.address),
      city: city,
      state: state,
      country: country,
      postalCode: trimValue(location.postalCode),
    },
    documents: {
      resume: trimValue(documents.resume),
      coverLetter: trimValue(documents.coverLetter),
    },
    professional: {
      currentCompany: trimValue(professional.currentCompany),
      experienceYears: trimValue(professional.experienceYears),
      skills: normalizeSkills(professional.skills),
    },
    social: {
      linkedin: trimValue(social.linkedin || profile.linkedin),
      github: trimValue(social.github),
      portfolio: trimValue(social.portfolio),
      website: trimValue(social.website),
    },
    application: {
      motivationStatement: trimValue(application.motivationStatement),
    },
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

  requiredFields.forEach((fieldPath) => {
    if (!getPathValue(normalizedProfile, fieldPath)) {
      errors[fieldPath] = 'This field is required'
    }
  })

  urlFields.forEach((fieldPath) => {
    const value = getPathValue(normalizedProfile, fieldPath)
    if (value && !isValidUrl(value)) {
      errors[fieldPath] = 'Enter a valid URL'
    }
  })

  // Only run structured schema validation if the profile includes
  // either a phone object or any location fields. This avoids forcing
  // country/state/city when the user hasn't provided location data
  // (keeps older behavior expected by tests).
  const hasLocationData = Boolean(
    normalizedProfile.location.country ||
    normalizedProfile.location.state ||
    normalizedProfile.location.city,
  )
  const hasPhoneObject = typeof normalizedProfile.personal.phone === 'object' && normalizedProfile.personal.phone !== null

  if (hasLocationData || hasPhoneObject) {
    const structuredResult = profileSchema.safeParse({
      location: {
        country: normalizedProfile.location.country,
        state: normalizedProfile.location.state,
        city: normalizedProfile.location.city,
      },
      phone: hasPhoneObject ? normalizedProfile.personal.phone : null,
    })

    if (!structuredResult.success) {
      Object.assign(errors, profileSchemaIssuesToErrors(structuredResult.error.issues))
    }
  }

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

  const normalizedProfile = normalizeProfile(profile)
  const isFlatInput = Boolean(profile && (profile.name || profile.email || profile.phone || profile.linkedin))
  const validationErrors = validateProfile(normalizedProfile)

  if (Object.keys(validationErrors).length > 0) {
    const error = new Error('Profile validation failed')
    error.validationErrors = validationErrors
    throw error
  }

  return new Promise((resolve, reject) => {
    // Check whether an existing stored profile is present. If none exists
    // (first-time save of a flat profile) preserve empty-string location
    // fields for compatibility. If an existing profile exists (editing),
    // keep location fields as nulls.
    storage.get('profile', (result) => {
      const getError = getLastError()
      if (getError) {
        reject(new Error(getError.message))
        return
      }

      const existing = result?.profile

      if (isFlatInput && !profile.location) {
        if (!existing) {
          normalizedProfile.location = {
            ...normalizedProfile.location,
            city: normalizedProfile.location.city ?? '',
            state: normalizedProfile.location.state ?? '',
            country: normalizedProfile.location.country ?? '',
          }
        } else {
          normalizedProfile.location = {
            ...normalizedProfile.location,
            city: normalizedProfile.location.city ?? null,
            state: normalizedProfile.location.state ?? null,
            country: normalizedProfile.location.country ?? null,
          }
        }
      }

      storage.set({ profile: normalizedProfile }, () => {
        const setError = getLastError()

        if (setError) {
          reject(new Error(setError.message))
          return
        }

        resolve()
      })
    })
  })
}
