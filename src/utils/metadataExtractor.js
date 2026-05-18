/**
 * Metadata Extractor
 *
 * Extracts company name and role title from Greenhouse / Lever application pages
 * using common DOM patterns and page metadata.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textOf(selector) {
  const el = document.querySelector(selector)
  return el ? el.textContent.trim() : ''
}

function metaContent(name) {
  const el =
    document.querySelector(`meta[property="${name}"]`) ||
    document.querySelector(`meta[name="${name}"]`)
  return el ? (el.getAttribute('content') || '').trim() : ''
}

// ---------------------------------------------------------------------------
// Greenhouse selectors
// ---------------------------------------------------------------------------

function extractGreenhouseMetadata() {
  const company =
    textOf('.company-name') ||
    textOf('[data-company-name]') ||
    textOf('#header .logo') ||
    ''

  const role =
    textOf('.app-title') ||
    textOf('.job-title') ||
    textOf('h1.heading') ||
    textOf('h1') ||
    ''

  return { company, role }
}

// ---------------------------------------------------------------------------
// Lever selectors
// ---------------------------------------------------------------------------

function extractLeverMetadata() {
  const company =
    textOf('.company-header .company-name') ||
    textOf('.main-header-content .company-name') ||
    textOf('.posting-headline .company-name') ||
    ''

  const role =
    textOf('.posting-headline h2') ||
    textOf('.section-header.posting-header h2') ||
    textOf('h2') ||
    ''

  return { company, role }
}

// ---------------------------------------------------------------------------
// Generic fallback using <title> and Open-Graph tags
// ---------------------------------------------------------------------------

function extractGenericMetadata() {
  const ogTitle = metaContent('og:title')
  const ogSiteName = metaContent('og:site_name')
  const pageTitle = document.title || ''

  // Many ATS pages follow "Role at Company" or "Role - Company" patterns
  let company = ogSiteName
  let role = ogTitle || pageTitle

  if (!company) {
    const separators = [' at ', ' - ', ' | ', ' — ', ' – ']
    for (const sep of separators) {
      if (pageTitle.includes(sep)) {
        const parts = pageTitle.split(sep)
        role = parts[0].trim()
        company = parts.slice(1).join(sep).trim()
        break
      }
    }
  }

  return { company, role }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract company name and role title from the current page.
 *
 * @returns {{ company: string, role: string }}
 */
export function extractPageMetadata() {
  const url = window.location.href.toLowerCase()

  let meta = { company: '', role: '' }

  try {
    if (url.includes('greenhouse.io')) {
      meta = extractGreenhouseMetadata()
    } else if (url.includes('lever.co')) {
      meta = extractLeverMetadata()
    }

    // Fall back to generic extraction if platform-specific selectors missed
    if (!meta.company || !meta.role) {
      const generic = extractGenericMetadata()
      meta.company = meta.company || generic.company
      meta.role = meta.role || generic.role
    }
  } catch (err) {
    console.warn('ApplyFlow: Metadata extraction error', err)
  }

  return meta
}
