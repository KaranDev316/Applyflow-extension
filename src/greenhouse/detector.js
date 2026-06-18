/**
 * Helpers for detecting Greenhouse resume and cover letter file inputs.
 */

const RESUME_KEYWORDS = ['resume', 'resume/cv', 'cv', 'upload resume']
const COVER_LETTER_KEYWORDS = ['cover letter', 'motivation letter', 'letter of interest']

function normalizeText(value) {
  return (value || '').toString().trim().toLowerCase()
}

function getAssociatedLabelText(input) {
  if (!input) return ''

  if (input.id) {
    const escapedId = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(input.id)
      : input.id.replace(/(["\\])/g, '\\$1')
    const label = document.querySelector(`label[for="${escapedId}"]`)
    if (label) return normalizeText(label.textContent)
  }

  const parentLabel = input.closest('label')
  if (parentLabel) return normalizeText(parentLabel.textContent)

  return ''
}

function collectNearbyText(input) {
  const texts = []
  const parent = input.parentElement

  if (parent) {
    texts.push(normalizeText(parent.textContent))
  }

  let sibling = input.previousElementSibling
  for (let index = 0; sibling && index < 3; index += 1) {
    texts.push(normalizeText(sibling.textContent))
    sibling = sibling.previousElementSibling
  }

  sibling = input.nextElementSibling
  for (let index = 0; sibling && index < 3; index += 1) {
    texts.push(normalizeText(sibling.textContent))
    sibling = sibling.nextElementSibling
  }

  return texts.join(' ')
}

function getSearchableText(input) {
  return [
    normalizeText(input.name),
    normalizeText(input.id),
    normalizeText(input.placeholder),
    normalizeText(input.getAttribute('aria-label')),
    getAssociatedLabelText(input),
    collectNearbyText(input),
  ]
    .filter(Boolean)
    .join(' ')
}

function matchesKeywords(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword))
}

export function isResumeField(input) {
  if (!input || input.tagName !== 'INPUT' || input.type !== 'file') return false
  const searchableText = getSearchableText(input)
  return matchesKeywords(searchableText, RESUME_KEYWORDS)
}

export function isCoverLetterField(input) {
  if (!input || input.tagName !== 'INPUT' || input.type !== 'file') return false
  const searchableText = getSearchableText(input)
  return matchesKeywords(searchableText, COVER_LETTER_KEYWORDS)
}
