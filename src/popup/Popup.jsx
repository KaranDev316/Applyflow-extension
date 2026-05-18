import { useEffect, useRef, useState } from 'react'

const actions = ['Profile', 'Edit Profile', 'Tracker']
const fields = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'email', label: 'Email', type: 'email' },
  { id: 'linkedin', label: 'LinkedIn', type: 'url' },
]

const emptyProfile = {
  name: '',
  email: '',
  linkedin: '',
}

function normalizeProfile(profile = {}) {
  return {
    name: profile.name ?? '',
    email: profile.email ?? '',
    linkedin: profile.linkedin ?? '',
  }
}

function loadProfile() {
  return new Promise((resolve, reject) => {
    if (!globalThis.chrome?.storage?.local) {
      resolve(emptyProfile)
      return
    }

    globalThis.chrome.storage.local.get('profile', (result) => {
      const error = globalThis.chrome.runtime?.lastError

      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(normalizeProfile(result.profile))
    })
  })
}

function saveProfile(profile) {
  return new Promise((resolve, reject) => {
    if (!globalThis.chrome?.storage?.local) {
      reject(new Error('chrome.storage.local is unavailable'))
      return
    }

    globalThis.chrome.storage.local.set({ profile }, () => {
      const error = globalThis.chrome.runtime?.lastError

      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve()
    })
  })
}

function Popup() {
  const [profile, setProfile] = useState(emptyProfile)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const savedMessageTimeoutRef = useRef(null)

  useEffect(() => {
    let isMounted = true

    loadProfile()
      .then((savedProfile) => {
        if (isMounted) {
          setProfile(savedProfile)
        }
      })
      .catch((error) => {
        console.error('Failed to load profile:', error)
        if (isMounted) {
          setLoadError('Unable to load saved profile')
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingProfile(false)
        }
      })

    return () => {
      isMounted = false
      window.clearTimeout(savedMessageTimeoutRef.current)
    }
  }, [])

  const handleFieldChange = (event) => {
    const { name, value } = event.target

    setIsSaved(false)
    setSaveError('')

    setProfile((currentProfile) => ({
      ...currentProfile,
      [name]: value,
    }))
  }

  const showSavedMessage = () => {
    window.clearTimeout(savedMessageTimeoutRef.current)
    setIsSaved(true)

    savedMessageTimeoutRef.current = window.setTimeout(() => {
      setIsSaved(false)
    }, 2000)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    setIsSaved(false)
    setSaveError('')

    console.log('Profile form values:', profile)

    try {
      await saveProfile(profile)
      showSavedMessage()
    } catch (error) {
      console.error('Failed to save profile:', error)
      setSaveError('Unable to save profile')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="w-80 bg-white p-5 text-slate-900">
      <header className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white">
          AF
        </div>
        <div>
          <h1 className="text-base font-semibold leading-tight">ApplyFlow</h1>
          <p className="text-xs text-slate-500">Job application helper</p>
        </div>
      </header>

      <div className="mb-5 grid grid-cols-3 gap-2">
        {actions.map((action) => (
          <button
            className="rounded-md border border-slate-200 px-2 py-2 text-sm font-medium transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900"
            key={action}
            type="button"
          >
            {action}
          </button>
        ))}
      </div>

      <form className="grid gap-3" onSubmit={handleSubmit}>
        {isLoadingProfile && (
          <p className="text-sm text-slate-500">Loading profile...</p>
        )}
        {loadError && (
          <p className="text-sm font-medium text-red-600">{loadError}</p>
        )}

        {fields.map((field) => (
          <label className="grid gap-1.5 text-sm font-medium" htmlFor={field.id} key={field.id}>
            {field.label}
            <input
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              disabled={isLoadingProfile}
              id={field.id}
              name={field.id}
              onChange={handleFieldChange}
              type={field.type}
              value={profile[field.id]}
            />
          </label>
        ))}

        <button
          className="mt-1 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={isLoadingProfile || isSaving}
          type="submit"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>

        {isSaved && (
          <p className="text-center text-sm font-medium text-emerald-600">Profile Saved</p>
        )}
        {saveError && (
          <p className="text-center text-sm font-medium text-red-600">{saveError}</p>
        )}
      </form>
    </main>
  )
}

export default Popup
