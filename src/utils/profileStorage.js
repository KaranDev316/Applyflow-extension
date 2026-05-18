export const emptyProfile = {
  name: '',
  email: '',
  linkedin: '',
}

function getStorageArea() {
  return globalThis.chrome?.storage?.local
}

function getLastError() {
  return globalThis.chrome?.runtime?.lastError
}

function normalizeProfile(profile = {}) {
  return {
    name: profile.name ?? '',
    email: profile.email ?? '',
    linkedin: profile.linkedin ?? '',
  }
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

export async function saveProfile(profile) {
  const storage = getStorageArea()

  if (!storage) {
    throw new Error('chrome.storage.local is unavailable')
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
