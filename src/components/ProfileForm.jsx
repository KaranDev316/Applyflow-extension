import { useEffect, useRef } from 'react'
import ProfileInput from './ProfileInput'
import ProfileLocationPhone from './ProfileLocationPhone'

const sections = [
  {
    title: 'Personal Information',
    fields: [
      { id: 'personal.firstName', label: 'First Name', type: 'text' },
      { id: 'personal.lastName', label: 'Last Name', type: 'text' },
      { id: 'personal.preferredName', label: 'Preferred Name', type: 'text' },
      { id: 'personal.email', label: 'Email', type: 'email' },
    ],
  },
  {
    title: 'Location',
    fields: [
      { id: 'location.address', label: 'Address', type: 'text' },
      { id: 'location.postalCode', label: 'Zip / Postal Code', type: 'text' },
    ],
  },
  {
    title: 'Documents',
    fields: [
      { id: 'documents.resume', label: 'Resume', type: 'text' },
      { id: 'documents.coverLetter', label: 'Cover Letter', type: 'text' },
    ],
  },
  {
    title: 'Professional Information',
    fields: [
      { id: 'professional.currentCompany', label: 'Current Company', type: 'text' },
      { id: 'professional.experienceYears', label: 'Years of Experience', type: 'text' },
      { id: 'professional.skills', label: 'Skills', type: 'text' },
    ],
  },
  {
    title: 'Social Links',
    fields: [
      { id: 'social.linkedin', label: 'LinkedIn', type: 'url' },
      { id: 'social.github', label: 'GitHub', type: 'url' },
      { id: 'social.portfolio', label: 'Portfolio', type: 'url' },
      { id: 'social.website', label: 'Website', type: 'url' },
    ],
  },
]

function getFieldValue(profile, fieldId) {
  const value = fieldId.split('.').reduce((current, key) => current?.[key], profile)
  return Array.isArray(value) ? value.join(', ') : value || ''
}

function ProfileForm({
  isLoading,
  isSaved,
  isSaving,
  loadError,
  onFieldChange,
  onLocationPhoneChange,
  onSubmit,
  profile,
  saveError,
  validationErrors = {},
}) {
  const statusRef = useRef(null)
  const wasSavedRef = useRef(false)

  useEffect(() => {
    if (!isSaved || wasSavedRef.current) {
      wasSavedRef.current = isSaved
      return
    }

    wasSavedRef.current = true

    const frameId = window.requestAnimationFrame(() => {
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

      statusRef.current?.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'nearest',
        inline: 'nearest',
      })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isSaved])

  return (
    <form className="grid gap-2.5" onSubmit={onSubmit}>
      {isLoading && (
        <p className="text-sm text-slate-500">Loading profile...</p>
      )}
      {loadError && (
        <p className="text-sm font-medium text-red-600">{loadError}</p>
      )}

      {sections.map((section) => (
        <section className="grid gap-2.5" key={section.title}>
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            {section.title}
          </h2>
          {section.fields.map((field) => (
            <ProfileInput
              disabled={isLoading}
              error={validationErrors[field.id]}
              field={field}
              key={field.id}
              onChange={onFieldChange}
              value={getFieldValue(profile, field.id)}
            />
          ))}
          {section.title === 'Location' && (
            <ProfileLocationPhone
              disabled={isLoading}
              errors={validationErrors}
              onChange={onLocationPhoneChange}
              profile={profile}
            />
          )}
        </section>
      ))}

      <button
        className="mt-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
        disabled={isLoading || isSaving}
        type="submit"
      >
        {isSaving ? 'Saving...' : 'Save'}
      </button>

      {isSaved && (
        <p
          className="scroll-mt-3 text-center text-sm font-medium text-emerald-600"
          ref={statusRef}
          role="status"
        >
          Profile Saved
        </p>
      )}
      {saveError && (
        <p className="text-center text-sm font-medium text-red-600">{saveError}</p>
      )}
    </form>
  )
}

export default ProfileForm
