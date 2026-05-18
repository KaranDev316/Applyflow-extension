import ProfileInput from './ProfileInput'

const fields = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'email', label: 'Email', type: 'email' },
  { id: 'phone', label: 'Phone', type: 'tel' },
  { id: 'linkedin', label: 'LinkedIn', type: 'url' },
]

function ProfileForm({
  isLoading,
  isSaved,
  isSaving,
  loadError,
  onFieldChange,
  onSubmit,
  profile,
  saveError,
}) {
  return (
    <form className="grid gap-2.5" onSubmit={onSubmit}>
      {isLoading && (
        <p className="text-sm text-slate-500">Loading profile...</p>
      )}
      {loadError && (
        <p className="text-sm font-medium text-red-600">{loadError}</p>
      )}

      {fields.map((field) => (
        <ProfileInput
          disabled={isLoading}
          field={field}
          key={field.id}
          onChange={onFieldChange}
          value={profile[field.id]}
        />
      ))}

      <button
        className="mt-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
        disabled={isLoading || isSaving}
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
  )
}

export default ProfileForm
