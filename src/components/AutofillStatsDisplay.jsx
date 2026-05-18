function AutofillStatsDisplay({ stats }) {
  if (!stats || stats.totalRuns === 0) return null

  return (
    <p className="text-center text-xs text-slate-400">
      {stats.totalRuns} autofill{stats.totalRuns !== 1 ? 's' : ''} ·{' '}
      {stats.totalFieldsFilled} field{stats.totalFieldsFilled !== 1 ? 's' : ''} filled
    </p>
  )
}

export default AutofillStatsDisplay
