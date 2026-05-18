import AutofillStatsDisplay from './AutofillStatsDisplay'

function SmartAutofill({ disabled, isLoading, message, onAutofill, status, stats }) {
  let buttonClasses =
    'rounded-md px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed'
  const messageClasses = 'text-center text-sm font-medium'
  let messageBgColor = ''

  if (status === 'success') {
    buttonClasses += ' bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-600 disabled:bg-emerald-400'
    messageBgColor = 'text-emerald-600'
  } else if (status === 'error') {
    messageBgColor = 'text-red-600'
    buttonClasses += ' bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-900 disabled:bg-slate-400'
  } else {
    buttonClasses += ' bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-900 disabled:bg-slate-400'
  }

  return (
    <div className="grid gap-2">
      <button
        className={buttonClasses}
        disabled={disabled || isLoading}
        onClick={onAutofill}
        type="button"
      >
        {isLoading ? 'Autofilling...' : 'Smart Autofill'}
      </button>

      {message && <p className={`${messageClasses} ${messageBgColor}`}>{message}</p>}
      <AutofillStatsDisplay stats={stats} />
    </div>
  )
}

export default SmartAutofill
