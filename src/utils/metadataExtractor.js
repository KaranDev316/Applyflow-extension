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

function attrOf(selector, attr) {
  const el = document.querySelector(selector)
  return el ? (el.getAttribute(attr) || '').trim() : ''
}

function metaContent(name) {
  const el =
    document.querySelector(`meta[property="${name}"]`) ||
    document.querySelector(`meta[name="${name}"]`)
  return el ? (el.getAttribute('content') || '').trim() : ''
}

function extractSchemaOrgMetadata() {
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]')
    for (const script of scripts) {
      if (!script.textContent) continue
      const parsed = JSON.parse(script.textContent)
      const items = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed])

      for (const item of items) {
        if (!item) continue
        const type = item['@type'] || item['@context'] || ''
        // Accept JobPosting even if provided as array/uppercase or with namespace
        const isJobPosting = Array.isArray(type)
          ? type.map((t) => String(t).toLowerCase()).includes('jobposting')
          : String(type).toLowerCase().includes('jobposting')

        if (isJobPosting) {
          // Try multiple common fields for role/title
          const role = (item.title || item.name || item.jobTitle || item.headline || '')
            .toString()
            .trim()
          // hiringOrganization can be an object or a string
          let company = ''
          if (item.hiringOrganization) {
            if (typeof item.hiringOrganization === 'string') {
              company = item.hiringOrganization.trim()
            } else if (typeof item.hiringOrganization === 'object') {
              company = (
                item.hiringOrganization.name ||
                item.hiringOrganization['@name'] ||
                ''
              ).toString().trim()
            }
          }

          if (role || company) {
            return { company, role }
          }
        }
      }
    }
  } catch (err) {
    // Silently fail on invalid JSON
  }
  return { company: '', role: '' }
}

// ---------------------------------------------------------------------------
// Greenhouse selectors
// ---------------------------------------------------------------------------

function extractGreenhouseMetadata() {
  const company =
    textOf('.company-name') ||
    textOf('[data-company-name]') ||
    textOf('#header .logo') ||
    textOf('.opening__company') ||
    textOf('.jv-company-name') ||
    ''

  const role =
    textOf('.app-title') ||
    textOf('.job-title') ||
    textOf('.position-title') ||
    textOf('.opening__title') ||
    textOf('.jv-job-title') ||
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
    textOf('.posting-company') ||
    textOf('[data-company-name]') ||
    ''

  const role =
    textOf('.posting-headline h2') ||
    textOf('.posting-headline h1') ||
    textOf('.section-header.posting-header h2') ||
    textOf('.section-header.posting-header h1') ||
    textOf('.posting-title') ||
    textOf('.posting-headline .posting-title') ||
    textOf('h2') ||
    textOf('h1') ||
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
  const lowerTitle = pageTitle.toLowerCase()

  const isConfirmationPage = /application submitted|submission received|your application has been received/i.test(lowerTitle)
  if (isConfirmationPage) {
    return { company: '', role: '' }
  }

  // Many ATS pages follow "Role at Company" or "Role - Company" patterns
  let company = ogSiteName
  let role = ogTitle || pageTitle

  // Clean up role and find company if it contains a separator
  const separators = [' at ', ' - ', ' | ', ' — ', ' – ']
  for (const sep of separators) {
    if (role.includes(sep)) {
      const parts = role.split(sep)
      role = parts[0].trim()
      if (!company) {
        company = parts.slice(1).join(sep).trim()
      }
      break
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

  const headerText = `${document.title || ''} ${document.querySelector('h1')?.textContent || ''}`.toLowerCase()
  const isConfirmationPage = /application submitted|submission received|your application has been received/i.test(headerText)

  if (isConfirmationPage) {
    return { company: '', role: '' }
  }

  let meta = { company: '', role: '' }

  try {
    // 1. Try structured data (JSON-LD) first as it handles UI/DOM updates best
    const schema = extractSchemaOrgMetadata()
    if (schema.company) meta.company = schema.company
    if (schema.role) meta.role = schema.role

    // 2. Try platform-specific selectors if missing
    if (!meta.company || !meta.role) {
      const isGreenhouse = url.includes('greenhouse.io') || !!document.querySelector('#application_form, #main_fields, .app-title')
      const isLever = url.includes('lever.co') || !!document.querySelector('#lever-form, .posting-headline')

      let platform = { company: '', role: '' }
      if (isGreenhouse) {
        platform = extractGreenhouseMetadata()
      } else if (isLever) {
        platform = extractLeverMetadata()
      }
      
      meta.company = meta.company || platform.company
      meta.role = meta.role || platform.role
    }

    // 3. Fall back to generic extraction if platform-specific selectors missed
    if (!meta.company || !meta.role) {
      const generic = extractGenericMetadata()
      meta.company = meta.company || generic.company
      meta.role = meta.role || generic.role
    }
  } catch (err) {
    console.warn('ApplyFlow: Metadata extraction error', err)
  }

  // Best-effort: try attribute-based fallbacks used by some job widgets
  if (!meta.role) {
    meta.role = attrOf('[data-job-title]', 'data-job-title') ||
      attrOf('[data-role]', 'data-role') ||
      attrOf('[aria-label*="job"]', 'aria-label') ||
      meta.role
  }

  console.debug('ApplyFlow: extractPageMetadata ->', meta)

  return meta
}
