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
    <div className={`rounded-full border ${borderColor} ${bgColor} px-3 py-2 text-sm leading-5`}>
      <p className={`font-medium ${textColor}`}>{status.message}</p>
    </div>
  )
}

export default PlatformStatus
