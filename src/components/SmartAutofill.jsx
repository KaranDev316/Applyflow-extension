function SmartAutofill({ disabled, isLoading, message, onAutofill, status, needsRefresh }) {
  let buttonClasses =
    'rounded-full px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed'
  const messageClasses = 'text-center text-sm font-medium'
  const helperClasses = 'text-center text-xs text-slate-400'
  let messageBgColor = ''

  if (status === 'success') {
    buttonClasses += ' bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-600 disabled:bg-emerald-600 disabled:opacity-80'
    messageBgColor = 'text-emerald-600'
  } else if (status === 'error') {
    if (needsRefresh) {
      buttonClasses += ' bg-red-600 text-white hover:bg-red-700 focus:ring-red-600 focus:ring-offset-red-100'
    } else {
    messageBgColor = 'text-red-600'
    buttonClasses += ' bg-slate-950 text-white hover:bg-slate-900 focus:ring-slate-900 disabled:bg-slate-950 disabled:opacity-80'
    }
  } else {
    buttonClasses += ' bg-slate-950 text-white hover:bg-slate-900 focus:ring-slate-900 disabled:bg-slate-950 disabled:opacity-80'
  }

  return (
    <div className="grid gap-2">
      <button
        className={buttonClasses}
        disabled={disabled || isLoading}
        onClick={onAutofill}
        type="button"
      >
        {isLoading ? 'Autofilling...' : needsRefresh ? 'Reload Page Now' : 'Autofill current job'}
      </button>

      {message ? (
        <p className={`${messageClasses} ${messageBgColor}`}>{message}</p>
      ) : disabled ? (
        <p className={helperClasses}>Autofill available on supported job boards</p>
      ) : null}
    </div>
  )
}

export default SmartAutofill
