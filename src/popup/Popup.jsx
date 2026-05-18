import { useEffect, useRef, useState } from 'react'
import { emptyProfile, getProfile, saveProfile } from '../utils/profileStorage'
import { getPlatformStatus } from '../utils/platformDetection'

const actions = ['Profile', 'Tracker']
const fields = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'email', label: 'Email', type: 'email' },
  { id: 'linkedin', label: 'LinkedIn', type: 'url' },
]

function ProfileInput({ disabled, field, onChange, value }) {
  return (
    <label className="grid gap-1 text-sm font-medium" htmlFor={field.id}>
      {field.label}
      <input
        className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-normal outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        disabled={disabled}
        id={field.id}
        name={field.id}
        onChange={onChange}
        type={field.type}
        value={value}
      />
    </label>
  )
}

function PlatformStatus({ status, isDetecting }) {
  if (isDetecting) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-sm text-slate-500">Detecting platform...</p>
      </div>
    )
  }

  if (!status) {
    return null
  }

  let bgColor = 'bg-slate-50'
  let borderColor = 'border-slate-200'
  let textColor = 'text-slate-700'

  if (status.type === 'supported') {
    bgColor = 'bg-emerald-50'
    borderColor = 'border-emerald-200'
    textColor = 'text-emerald-700'
  } else if (status.type === 'unsupported') {
    bgColor = 'bg-amber-50'
    borderColor = 'border-amber-200'
    textColor = 'text-amber-700'
  } else if (status.type === 'error') {
    bgColor = 'bg-red-50'
    borderColor = 'border-red-200'
    textColor = 'text-red-700'
  }

  return (
    <div
      className={`rounded-md border ${borderColor} ${bgColor} px-3 py-2`}
    >
      <p className={`text-sm font-medium ${textColor}`}>{status.message}</p>
    </div>
  )
}

function Popup() {
  const [profile, setProfile] = useState(emptyProfile)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [platformStatus, setPlatformStatus] = useState(null)
  const [isDetectingPlatform, setIsDetectingPlatform] = useState(true)
  const savedMessageTimeoutRef = useRef(null)

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      try {
        // Load saved profile
        const savedProfile = await getProfile()

        if (isMounted) {
          setProfile(savedProfile)
        }
      } catch (error) {
        console.error('Failed to load profile:', error)
        if (isMounted) {
          setLoadError('Unable to load saved profile')
        }
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false)
        }
      }

      // Detect current platform
      try {
        const status = await getPlatformStatus()

        if (isMounted) {
          setPlatformStatus(status)
        }
      } catch (error) {
        console.error('Failed to detect platform:', error)
        if (isMounted) {
          setPlatformStatus({
            message: 'Unable to detect platform',
            type: 'error',
            name: null,
          })
        }
      } finally {
        if (isMounted) {
          setIsDetectingPlatform(false)
        }
      }
    }

    loadInitialData()

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
    <main className="w-80 bg-white p-4 text-slate-900">
      <header className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white">
          AF
        </div>
        <div>
          <h1 className="text-base font-semibold leading-tight">ApplyFlow</h1>
          <p className="text-xs text-slate-500">Job application helper</p>
        </div>
      </header>

      <PlatformStatus isDetecting={isDetectingPlatform} status={platformStatus} />

      <div className="mb-4 mt-4 grid grid-cols-2 gap-1.5">
        {actions.map((action) => (
          <button
            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
            key={action}
            type="button"
          >
            {action}
          </button>
        ))}
      </div>

      <form className="grid gap-2.5" onSubmit={handleSubmit}>
        {isLoadingProfile && (
          <p className="text-sm text-slate-500">Loading profile...</p>
        )}
        {loadError && (
          <p className="text-sm font-medium text-red-600">{loadError}</p>
        )}

        {fields.map((field) => (
          <ProfileInput
            disabled={isLoadingProfile}
            field={field}
            key={field.id}
            onChange={handleFieldChange}
            value={profile[field.id]}
          />
        ))}

        <button
          className="mt-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
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
