const actions = ['Autofill', 'Edit Profile', 'Tracker']

function Popup() {
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

      <div className="grid gap-2">
        {actions.map((action) => (
          <button
            className="w-full rounded-md border border-slate-200 px-4 py-3 text-left text-sm font-medium transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900"
            key={action}
            type="button"
          >
            {action}
          </button>
        ))}
      </div>
    </main>
  )
}

export default Popup
