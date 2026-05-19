function formatDate(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-1.5 py-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-lg">
        📋
      </div>
      <p className="text-sm font-medium text-slate-600">No applications yet</p>
      <p className="text-xs text-slate-400">
        Applications will appear here after you autofill a form.
      </p>
    </div>
  )
}

function ApplicationItem({ application, onDelete }) {
  return (
    <div className="group flex items-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">
          {application.role || 'Untitled Role'}
        </p>
        <p className="truncate text-xs text-slate-500">
          {application.company || 'Unknown Company'}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs text-slate-400">
            {formatDate(application.appliedAt)}
          </span>
          {application.url && (
            <>
              <span className="text-xs text-slate-300">·</span>
              <a
                className="truncate text-xs text-blue-500 hover:text-blue-600 hover:underline"
                href={application.url}
                rel="noopener noreferrer"
                target="_blank"
                title={application.url}
              >
                View posting
              </a>
            </>
          )}
        </div>
      </div>
      <button
        aria-label="Delete application"
        className="mt-0.5 shrink-0 rounded p-0.5 text-slate-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 focus:opacity-100"
        onClick={() => onDelete(application.id)}
        type="button"
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}

function ApplicationList({ applications, error, isLoading, onDelete }) {
  if (isLoading) {
    return <p className="py-4 text-center text-sm text-slate-500">Loading...</p>
  }

  if (error) {
    return <p className="py-4 text-center text-sm font-medium text-red-600">{error}</p>
  }

  if (applications.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="grid gap-1.5">
      <p className="text-xs font-medium text-slate-400">
        {applications.length} application{applications.length !== 1 ? 's' : ''}
      </p>
      {applications.map((app) => (
        <ApplicationItem
          application={app}
          key={app.id}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

export default ApplicationList
