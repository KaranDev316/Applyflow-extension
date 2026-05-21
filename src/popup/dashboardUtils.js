function getRecordKey(record) {
  const company = (record.company || '').trim().toLowerCase()
  const role = (record.role || '').trim().toLowerCase()
  const url = (record.url || '').trim().toLowerCase()
  return `${company}||${role}||${url}`
}

function getStatus(record) {
  return typeof record.status === 'string' ? record.status : 'applied'
}

function chooseBestRecord(first, second) {
  if (getStatus(first) === getStatus(second)) {
    return first.appliedAt >= second.appliedAt ? first : second
  }

  if (getStatus(first) === 'applied') return first
  if (getStatus(second) === 'applied') return second

  return first.appliedAt >= second.appliedAt ? first : second
}

function dedupeApplications(applications) {
  const grouped = new Map()

  for (const application of applications || []) {
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

export function computeMetrics(applications) {
  const now = new Date()
  const uniqueApps = dedupeApplications(Array.isArray(applications) ? applications : [])
  const applied = uniqueApps.filter((a) => getStatus(a) === 'applied')
  const drafts = uniqueApps.filter((a) => getStatus(a) === 'draft')

  const total = applied.length
  const today = applied.filter((a) => {
    if (!a || !a.appliedAt) return false
    const d = new Date(a.appliedAt)
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    )
  }).length

  return { total, today, drafts: drafts.length }
}

export default computeMetrics
