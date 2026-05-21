import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import esbuild from 'esbuild'
import path from 'node:path'
import React from 'react'
import { renderToString } from 'react-dom/server'

const componentPath = path.resolve('./src/components/ApplicationList.jsx')
let ApplicationList

const require = createRequire(import.meta.url)

function loadApplicationList() {
  if (ApplicationList) return ApplicationList

  const tmpDir = path.resolve('./tests/.tmp')
  fs.mkdirSync(tmpDir, { recursive: true })
  const outFile = path.join(tmpDir, `app-list-test-${Date.now()}.cjs`)

  esbuild.buildSync({
    entryPoints: [componentPath],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    external: ['react', 'react/jsx-runtime'],
    outfile: outFile,
    sourcemap: false,
  })

  const module = require(outFile)
  ApplicationList = module.default || module
  return ApplicationList
}

test('ApplicationList renders empty tracker state safely', () => {
  const ApplicationListComponent = loadApplicationList()
  const html = renderToString(
    React.createElement(ApplicationListComponent, {
      applications: [],
      error: null,
      isLoading: false,
      onDelete: () => {},
    })
  )

  assert.ok(html.includes('No applications yet'))
  assert.ok(html.includes('Applications will appear here after you autofill a form.'))
})

test('ApplicationList renders draft and applied items with status badges', () => {
  const ApplicationListComponent = loadApplicationList()
  const now = new Date().toISOString()
  const html = renderToString(
    React.createElement(ApplicationListComponent, {
      applications: [
        { id: '1', company: 'Initech', role: 'Developer', url: 'https://jobs/1', status: 'draft', appliedAt: now },
        { id: '2', company: 'Acme Corp', role: 'Designer', url: 'https://jobs/2', status: 'applied', appliedAt: now },
      ],
      error: null,
      isLoading: false,
      onDelete: () => {},
    })
  )

  assert.ok(html.includes('Developer'))
  assert.ok(html.includes('Initech'))
  assert.ok(html.includes('Designer'))
  assert.ok(html.includes('Acme Corp'))
  assert.ok(html.includes('Draft'))
  assert.ok(html.includes('Applied'))
  assert.ok(html.includes('View posting'))
  assert.ok(html.includes('href="https://jobs/1"'))
  assert.ok(html.includes('href="https://jobs/2"'))
})

test('ApplicationList tracker summary counts only applied applications', () => {
  const ApplicationListComponent = loadApplicationList()
  const now = new Date().toISOString()
  const html = renderToString(
    React.createElement(ApplicationListComponent, {
      applications: [
        { id: '1', company: 'Initech', role: 'Developer', url: 'https://jobs/1', status: 'draft', appliedAt: now },
        { id: '2', company: 'Acme Corp', role: 'Designer', url: 'https://jobs/2', status: 'applied', appliedAt: now },
      ],
      error: null,
      isLoading: false,
      onDelete: () => {},
    })
  )

  assert.ok(html.includes('<p class="text-lg font-semibold text-slate-800">1</p>'))
  assert.ok(html.includes('<p class="text-lg font-semibold text-emerald-600">1</p>'))
})

test('ApplicationList dedupes matching job records and groups by status', () => {
  const ApplicationListComponent = loadApplicationList()
  const now = new Date().toISOString()
  const html = renderToString(
    React.createElement(ApplicationListComponent, {
      applications: [
        { id: '1', company: 'Initech', role: 'Developer', url: 'https://jobs/1', status: 'draft', appliedAt: now },
        { id: '2', company: 'Initech', role: 'Developer', url: 'https://jobs/1', status: 'applied', appliedAt: now },
        { id: '3', company: 'Acme Corp', role: 'Designer', url: 'https://jobs/2', status: 'draft', appliedAt: now },
      ],
      error: null,
      isLoading: false,
      onDelete: () => {},
    })
  )

  assert.ok(html.includes('Draft applications'))
  assert.ok(html.includes('Applied applications'))
  assert.equal((html.match(/View posting/g) || []).length, 2)
})
