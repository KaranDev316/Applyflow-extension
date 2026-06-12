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
    preferredName: '',
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
  const country = toLocationCountry(location.country)
  const state = toLocationState(location.state, country?.code)
  const city = toLocationCity(location.city, country?.code, state?.code)
  const phone = normalizePhoneForCountry(personal.phone || profile.phone, country?.code)

  return {
    personal: {
      firstName: trimValue(personal.firstName) || migratedName.firstName,
      lastName: trimValue(personal.lastName) || migratedName.lastName,
      preferredName: trimValue(personal.preferredName),
      email: trimValue(personal.email || profile.email),
      phone,
    },
    location: {
      address: trimValue(location.address),
      city,
      state,
      country,
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

  const structuredResult = profileSchema.safeParse({
    location: {
      country: normalizedProfile.location.country,
      state: normalizedProfile.location.state,
      city: normalizedProfile.location.city,
    },
    phone: normalizedProfile.personal.phone,
  })

  if (!structuredResult.success) {
    Object.assign(errors, profileSchemaIssuesToErrors(structuredResult.error.issues))
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
  const validationErrors = validateProfile(normalizedProfile)

  if (Object.keys(validationErrors).length > 0) {
    const error = new Error('Profile validation failed')
    error.validationErrors = validationErrors
    throw error
  }

  return new Promise((resolve, reject) => {
    storage.set({ profile: normalizedProfile }, () => {
      const error = getLastError()

      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve()
    })
  })
}
