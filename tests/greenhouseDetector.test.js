import assert from 'node:assert'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { isResumeField, isCoverLetterField } from '../src/greenhouse/detector.js'

test('detects resume file input via label text', () => {
  const dom = new JSDOM(`<!DOCTYPE html><body><label for="resume">Upload Resume</label><input id="resume" type="file" /></body>`)
  global.document = dom.window.document
  global.window = dom.window

  const input = document.querySelector('input[type="file"]')
  assert.ok(isResumeField(input), 'Expected resume field to be detected')
  assert.strictEqual(isCoverLetterField(input), false)
})

test('detects cover letter file input via aria-label', () => {
  const dom = new JSDOM(`<!DOCTYPE html><body><input type="file" aria-label="Cover Letter upload" /></body>`)
  global.document = dom.window.document
  global.window = dom.window

  const input = document.querySelector('input[type="file"]')
  assert.ok(isCoverLetterField(input), 'Expected cover letter field to be detected')
  assert.strictEqual(isResumeField(input), false)
})

test('detects resume field using surrounding text', () => {
  const dom = new JSDOM(`<!DOCTYPE html><body><div>Resume/CV</div><input type="file" /></body>`)
  global.document = dom.window.document
  global.window = dom.window

  const input = document.querySelector('input[type="file"]')
  assert.ok(isResumeField(input), 'Expected resume field to be detected from nearby text')
})
