import { useCallback, useState } from 'react'

function formatDate(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getStatus(record) {
  return typeof record.status === 'string' ? record.status : 'applied'
}

function getRecordKey(record) {
  const company = (record.company || '').trim().toLowerCase()
  const role = (record.role || '').trim().toLowerCase()
  const url = (record.url || '').trim().toLowerCase()
  return `${company}||${role}||${url}`
}

function chooseBestRecord(first, second) {
  const firstStatus = getStatus(first)
  const secondStatus = getStatus(second)

  if (firstStatus === secondStatus) {
    return first.appliedAt >= second.appliedAt ? first : second
  }
  if (firstStatus === 'applied') return first
  if (secondStatus === 'applied') return second
  return first.appliedAt >= second.appliedAt ? first : second
}

function dedupeApplications(applications = []) {
  const grouped = new Map()

  for (const application of applications) {
    if (!application || typeof application !== 'object') continue
    const key = getRecordKey(application)
    if (!grouped.has(key)) {
      grouped.set(key, application)
      continue
    }
    grouped.set(key, chooseBestRecord(grouped.get(key), application))
  }

  return Array.from(grouped.values())
}

function isToday(isoString) {
  if (!isoString) return false
  const date = new Date(isoString)
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

function TrackerMetrics({ applications }) {
  const unique = dedupeApplications(applications)
  const applied = unique.filter((app) => getStatus(app) === 'applied')
  const drafts = unique.filter((app) => getStatus(app) === 'draft').length
  const total = applied.length
  const today = applied.filter((app) => isToday(app.appliedAt)).length

  return (
    <div className="grid grid-cols-3 gap-1.5">
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-center">
        <p className="text-lg font-semibold text-slate-800">{total}</p>
        <p className="text-xs text-slate-500">Total</p>
      </div>
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-center">
        <p className="text-lg font-semibold text-emerald-600">{today}</p>
        <p className="text-xs text-slate-500">Today</p>
      </div>
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-center">
        <p className="text-lg font-semibold text-amber-600">{drafts}</p>
        <p className="text-xs text-slate-500">Drafts</p>
      </div>
    </div>
  )
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
  const [confirming, setConfirming] = useState(false)

  const handleDeleteClick = useCallback(() => {
    if (confirming) {
      onDelete(application.id)
    } else {
      setConfirming(true)
      // Auto-cancel after 3 seconds
      setTimeout(() => setConfirming(false), 3000)
    }
  }, [confirming, application.id, onDelete])

  return (
    <div className="group flex items-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">
          {application.role || 'Untitled Role'}
        </p>
        <p className="truncate text-xs text-slate-500">
          {application.company || 'Unknown Company'}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
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
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              application.status === 'applied'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {application.status === 'applied' ? 'Applied' : 'Draft'}
          </span>
        </div>
      </div>
      <button
        aria-label={confirming ? 'Confirm delete' : 'Delete application'}
        className={`mt-0.5 shrink-0 rounded px-1 py-0.5 text-xs font-medium transition-all ${
          confirming
            ? 'bg-red-50 text-red-600 opacity-100 hover:bg-red-100'
            : 'text-slate-300 opacity-0 hover:text-red-500 group-hover:opacity-100 focus:opacity-100'
        }`}
        onClick={handleDeleteClick}
        type="button"
      >
        {confirming ? 'Sure?' : '✕'}
      </button>
    </div>
  )
}

function ApplicationList({ applications, error, isLoading, onDelete, statusFilter = 'all' }) {
  if (isLoading) {
    return <p className="py-4 text-center text-sm text-slate-500">Loading...</p>
  }

  if (error) {
    return <p className="py-4 text-center text-sm font-medium text-red-600">{error}</p>
  }

  const normalizedApplications = dedupeApplications(applications)
  const appliedApplications = normalizedApplications.filter((app) => getStatus(app) === 'applied')
  const draftApplications = normalizedApplications.filter((app) => getStatus(app) === 'draft')
  const filteredAppliedApplications = statusFilter === 'all' || statusFilter === 'applied' ? appliedApplications : []
  const filteredDraftApplications = statusFilter === 'all' || statusFilter === 'draft' ? draftApplications : []
  const visibleApplications = [...filteredDraftApplications, ...filteredAppliedApplications]

  if (visibleApplications.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="grid gap-2.5">
      <TrackerMetrics applications={normalizedApplications} />
      <div className="space-y-4">
        {filteredDraftApplications.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Draft applications
            </h2>
            <div className="grid gap-1.5">
              {filteredDraftApplications.map((app) => (
                <ApplicationItem key={app.id} application={app} onDelete={onDelete} />
              ))}
            </div>
          </section>
        )}

        {filteredAppliedApplications.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Applied applications
            </h2>
            <div className="grid gap-1.5">
              {filteredAppliedApplications.map((app) => (
                <ApplicationItem key={app.id} application={app} onDelete={onDelete} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

export { ApplicationItem, TrackerMetrics }
export default ApplicationList
