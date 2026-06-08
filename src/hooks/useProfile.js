import { useEffect, useRef, useState } from 'react'
import {
  emptyProfile,
  getProfile,
  saveProfile,
  validateProfile,
} from '../utils/profileStorage'

export function useProfile() {
  const [profile, setProfile] = useState(emptyProfile)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [validationErrors, setValidationErrors] = useState({})
  const savedMessageTimeoutRef = useRef(null)

  useEffect(() => {
    let isMounted = true

    async function loadProfile() {
      try {
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
    }

    loadProfile()

    return () => {
      isMounted = false
      window.clearTimeout(savedMessageTimeoutRef.current)
    }
  }, [])

  const handleFieldChange = (event) => {
    const { name, value } = event.target
    const path = name.split('.')

    setIsSaved(false)
    setSaveError('')
    setValidationErrors((currentErrors) => ({
      ...currentErrors,
      [name]: '',
    }))

    setProfile((currentProfile) => ({
      ...currentProfile,
      [path[0]]: {
        ...currentProfile[path[0]],
        [path[1]]: name === 'professional.skills'
          ? value.split(',').map((skill) => skill.trim()).filter(Boolean)
          : value,
      },
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
      const errors = validateProfile(profile)

      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors)
        return
      }

      setValidationErrors({})
      await saveProfile(profile)
      showSavedMessage()
    } catch (error) {
      console.error('Failed to save profile:', error)
      if (error.validationErrors) {
        setValidationErrors(error.validationErrors)
        return
      }
      setSaveError('Unable to save profile')
    } finally {
      setIsSaving(false)
    }
  }

  return {
    handleFieldChange,
    handleSubmit,
    isLoadingProfile,
    isSaved,
    isSaving,
    loadError,
    profile,
    saveError,
    validationErrors,
  }
}
