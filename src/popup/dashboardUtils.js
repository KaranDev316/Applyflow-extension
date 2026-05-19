export function computeMetrics(applications) {
  const total = Array.isArray(applications) ? applications.length : 0
  const now = new Date()
  const today = (applications || []).filter((a) => {
    if (!a || !a.appliedAt) return false
    const d = new Date(a.appliedAt)
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    )
  }).length

  return { total, today }
}

export default computeMetrics
