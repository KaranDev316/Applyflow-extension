import { useState } from 'react'

const actions = ['Profile', 'Edit Profile', 'Tracker']
const fields = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'email', label: 'Email', type: 'email' },
  { id: 'linkedin', label: 'LinkedIn', type: 'url' },
]

function Popup() {
  const [isSaved, setIsSaved] = useState(false)

  const handleSubmit = (event) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const profile = {
      name: formData.get('name'),
      email: formData.get('email'),
      linkedin: formData.get('linkedin'),
    }

    console.log('Profile form values:', profile)
    setIsSaved(true)

    window.setTimeout(() => {
      setIsSaved(false)
    }, 2000)
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
        {fields.map((field) => (
          <label className="grid gap-1.5 text-sm font-medium" htmlFor={field.id} key={field.id}>
            {field.label}
            <input
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              id={field.id}
              name={field.id}
              type={field.type}
            />
          </label>
        ))}

        <button
          className="mt-1 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
          type="submit"
        >
          Save
        </button>

        {isSaved && (
          <p className="text-center text-sm font-medium text-emerald-600">Profile Saved</p>
        )}
      </form>
    </main>
  )
}

export default Popup
