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
  assert.deepEqual(computeMetrics(null), { total: 0, today: 0, drafts: 0 })
  assert.deepEqual(computeMetrics([]), { total: 0, today: 0, drafts: 0 })
  assert.deepEqual(computeMetrics([{}, { appliedAt: null }]), { total: 1, today: 0, drafts: 0 })
})

test('computeMetrics counts only applied applications', () => {
  const now = new Date().toISOString()
  const apps = [
    { id: '1', company: 'A', role: 'X', status: 'draft', appliedAt: now },
    { id: '2', company: 'B', role: 'Y', status: 'applied', appliedAt: now },
  ]

  const metrics = computeMetrics(apps)
  assert.equal(metrics.total, 1)
  assert.equal(metrics.today, 1)
  assert.equal(metrics.drafts, 1)
})

test('computeMetrics prefers applied over draft for matching application records', () => {
  const now = new Date().toISOString()
  const apps = [
    { id: '1', company: 'A', role: 'X', url: 'https://jobs/1', status: 'draft', appliedAt: now },
    { id: '2', company: 'A', role: 'X', url: 'https://jobs/1', status: 'applied', appliedAt: now },
  ]

  const metrics = computeMetrics(apps)
  assert.equal(metrics.total, 1)
  assert.equal(metrics.today, 1)
  assert.equal(metrics.drafts, 0)
})
