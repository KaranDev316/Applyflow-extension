import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeMetrics } from '../src/popup/dashboardUtils.js'

test('computeMetrics returns correct total and today counts', () => {
  const now = new Date()
  const todayIso = now.toISOString()
  const yesterdayIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  const apps = [
    { id: '1', company: 'A', role: 'X', appliedAt: todayIso },
    { id: '2', company: 'B', role: 'Y', appliedAt: todayIso },
    { id: '3', company: 'C', role: 'Z', appliedAt: yesterdayIso },
  ]

  const metrics = computeMetrics(apps)
  assert.equal(metrics.total, 3)
  assert.equal(metrics.today, 2)
})

test('computeMetrics handles empty or malformed inputs', () => {
  assert.deepEqual(computeMetrics(null), { total: 0, today: 0 })
  assert.deepEqual(computeMetrics([]), { total: 0, today: 0 })
  assert.deepEqual(computeMetrics([{}, { appliedAt: null }]), { total: 2, today: 0 })
})
