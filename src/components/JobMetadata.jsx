function JobMetadata({ metadata }) {
  if (!metadata || (!metadata.company && !metadata.role)) return null

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      {metadata.role && (
        <p className="truncate text-sm font-medium text-slate-700">{metadata.role}</p>
      )}
      {metadata.company && (
        <p className="truncate text-xs text-slate-500">{metadata.company}</p>
      )}
    </div>
  )
}

export default JobMetadata
