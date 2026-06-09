/**
 * Smart Autofill Engine
 *
 * Modular engine that maps saved profile data to detected form fields and
 * fills them using the correct DOM technique for each element type.
 *
 * Supported element types:
 *  - text / email / url / tel  <input>
 *  - <textarea>
 *  - <select>
 *  - <input type="checkbox">
 *
 * Design goals:
 *  - Keep one handler per element type (easy to extend).
 *  - Trigger the events React / framework-controlled forms listen on.
 *  - Never throw on an unknown or disconnected field – just skip it.
 */

// ---------------------------------------------------------------------------
// Event helpers
// ---------------------------------------------------------------------------

/**
 * Dispatch `input` and `change` events that React 15-19+ and other
 * frameworks listen on.  Uses native-value-setter trick so React's
 * synthetic-event system picks up the change.
 */
function dispatchInputEvents(element) {
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

/**
 * Focus → set value → blur pattern that mimics real user interaction.
 */
function focusAndBlur(element) {
  element.dispatchEvent(new Event('focus', { bubbles: true }))
  // Actual value setting happens between focus / blur in the caller.
  // We call blur *after* the value has been written.
  setTimeout(() => {
    element.dispatchEvent(new Event('blur', { bubbles: true }))
  }, 0)
}

// ---------------------------------------------------------------------------
// Per-type fill handlers
// ---------------------------------------------------------------------------

/**
 * Set a text-like input's value using the native setter so that React
 * controlled components recognise the change.
 */
function fillTextInput(element, value) {
  const proto =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype

  const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set

  focusAndBlur(element)

  if (nativeSetter) {
    nativeSetter.call(element, value)
  } else {
    element.value = value
  }

  dispatchInputEvents(element)
}

/**
 * Select the first <option> whose value or visible text matches `value`
 * (case-insensitive, trimmed).
 */
function fillSelect(element, value) {
  if (!value) return false

  const needle = value.trim().toLowerCase()
  const options = Array.from(element.options)

  const match = options.find(
    (opt) =>
      opt.value.toLowerCase() === needle ||
      opt.textContent.trim().toLowerCase() === needle,
  )

  if (!match) return false

  element.value = match.value
  dispatchInputEvents(element)
  return true
}

/**
 * Set a checkbox to checked / unchecked.
 * `value` is coerced to boolean — truthy = checked.
 */
function fillCheckbox(element, value) {
  const desired = Boolean(value)
  if (element.checked !== desired) {
    element.checked = desired
    element.dispatchEvent(new Event('click', { bubbles: true }))
    dispatchInputEvents(element)
  }
  return true
}

// ---------------------------------------------------------------------------
// Profile ↔ Field mapping
// ---------------------------------------------------------------------------

/**
 * Map from profile keys → detected-field categories.
 * Order matters – fields are filled in this order.
 */
const PROFILE_FIELD_MAP = [
  { profileKey: 'personal.firstName', fieldCategory: 'firstName' },
  { profileKey: 'personal.lastName', fieldCategory: 'lastName' },
  { profileKey: 'name', fieldCategory: 'name' },
  { profileKey: 'personal.email', fieldCategory: 'email' },
  { profileKey: 'personal.phone', fieldCategory: 'phone' },
  { profileKey: 'location.address', fieldCategory: 'address' },
  { profileKey: 'location.city', fieldCategory: 'city' },
  { profileKey: 'location.state', fieldCategory: 'state' },
  { profileKey: 'location.country', fieldCategory: 'country' },
  { profileKey: 'location.postalCode', fieldCategory: 'postalCode' },
  { profileKey: 'social.linkedin', fieldCategory: 'linkedin' },
  { profileKey: 'social.github', fieldCategory: 'github' },
  { profileKey: 'social.portfolio', fieldCategory: 'portfolio' },
  { profileKey: 'social.website', fieldCategory: 'website' },
  { profileKey: 'professional.currentCompany', fieldCategory: 'currentCompany' },
]

function getProfileValue(profile, path) {
  if (path === 'name') {
    const legacyName = profile?.name
    if (legacyName) return legacyName

    return [profile?.personal?.firstName, profile?.personal?.lastName]
      .filter(Boolean)
      .join(' ')
  }

  const value = path.split('.').reduce((current, key) => current?.[key], profile)
  return Array.isArray(value) ? value.join(', ') : value
}

function getLegacyProfileValue(profile, path) {
  const legacyKey = path.split('.').at(-1)
  return profile?.[legacyKey]
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fill a single DOM element with the given value, choosing the right
 * strategy based on element type.  Returns `true` when a value was written.
 */
export function fillField(element, value) {
  if (!element?.isConnected) return false
  if (value === undefined || value === null) return false

  const tag = element.tagName.toLowerCase()

  try {
    if (tag === 'select') {
      return fillSelect(element, String(value))
    }

    if (tag === 'input' && element.type === 'checkbox') {
      return fillCheckbox(element, value)
    }

    if (tag === 'textarea' || tag === 'input') {
      fillTextInput(element, String(value))
      return true
    }

    // Unknown element type — skip safely
    console.warn('ApplyFlow: Skipping unsupported element', tag, element)
    return false
  } catch (err) {
    console.warn('ApplyFlow: Error filling field', element, err)
    return false
  }
}

/**
 * Run the full autofill pipeline:
 *  1. Walk the PROFILE_FIELD_MAP.
 *  2. For each profile key that has a value, try filling the first
 *     matching detected field.
 *  3. Return a summary with the count of filled fields.
 *
 * @param {object} profile  – Saved profile data  { name, email, phone, linkedin }
 * @param {object} fields   – Output of `detectFormFields()`
 * @returns {{ filledCount: number, skippedCount: number, details: Array }}
 */
export function autofillFromProfile(profile, fields) {
  const details = []
  let filledCount = 0
  let skippedCount = 0

  for (const { profileKey, fieldCategory } of PROFILE_FIELD_MAP) {
    const value = getProfileValue(profile, profileKey) || getLegacyProfileValue(profile, profileKey)
    const candidates = fields[fieldCategory]

    if (!value || !candidates || candidates.length === 0) {
      skippedCount += 1
      details.push({ field: fieldCategory, status: 'skipped', reason: !value ? 'empty_value' : 'no_match' })
      continue
    }

    // Fill the first matching candidate
    const target = candidates[0]
    const filled = fillField(target.element, value)

    if (filled) {
      filledCount += 1
      details.push({ field: fieldCategory, status: 'filled', id: target.id, name: target.name })
    } else {
      skippedCount += 1
      details.push({ field: fieldCategory, status: 'skipped', reason: 'fill_failed' })
    }
  }

  return { filledCount, skippedCount, details }
}

/**
 * Attempt to auto-select relevant options for any <select> elements
 * using heuristics (e.g. matching profile country, gender, etc.).
 * Fills only selects whose labels match known mappings.
 *
 * @param {Array} selectFields – `fields.select` from `detectFormFields()`
 * @param {object} profile     – Saved profile data
 * @returns {number} Number of selects filled
 */
function getAssociatedLabelText(element) {
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`)
    if (label) return label.textContent.trim()
  }

  const parentLabel = element.closest('label')
  if (parentLabel) return parentLabel.textContent.trim()

  return ''
}
function selectHasExactProfileValue(element, profile) {
  const candidates = [
    profile?.name,
    profile?.email,
    profile?.phone,
    profile?.linkedin,
    profile?.personal?.firstName,
    profile?.personal?.lastName,
    profile?.personal?.preferredName,
    profile?.personal?.email,
    profile?.personal?.phone,
    profile?.location?.address,
    profile?.location?.city,
    profile?.location?.state,
    profile?.location?.country,
    profile?.location?.postalCode,
    profile?.professional?.currentCompany,
    profile?.social?.linkedin,
    profile?.social?.github,
    profile?.social?.portfolio,
    profile?.social?.website,
    ...(profile?.professional?.skills || []),
  ]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .map((value) => String(value).trim().toLowerCase())

  for (const option of element.options) {
    const optionValue = String(option.value || option.textContent || '').trim().toLowerCase()
    if (candidates.includes(optionValue)) {
      return optionValue
    }
  }

  return null
}

export function autofillSelects(selectFields, profile) {
  let filled = 0

  for (const sel of selectFields) {
    const text = [sel.name, sel.id, sel.element.getAttribute('aria-label') || '', getAssociatedLabelText(sel.element)]
      .join(' ')
      .toLowerCase()

    const email = profile?.personal?.email || profile?.email
    const phone = profile?.personal?.phone || profile?.phone

    if (text.includes('phone') && phone) {
      // Phone country-code selects — skip, handled by phone input
      continue
    }

    const matchingValue = selectHasExactProfileValue(sel.element, profile)

    if (matchingValue && fillField(sel.element, matchingValue)) {
      filled += 1
      continue
    }

    const contactMode = text.includes('contact') || text.includes('preferred method')
    if (contactMode && email) {
      if (fillField(sel.element, 'Email')) {
        filled += 1
        continue
      }
      if (fillField(sel.element, 'email')) {
        filled += 1
        continue
      }
    }

    if (contactMode && phone) {
      if (fillField(sel.element, 'Phone')) {
        filled += 1
        continue
      }
      if (fillField(sel.element, 'phone')) {
        filled += 1
        continue
      }
    }
  }

  return filled
}

/**
 * Check consent / agreement checkboxes that are commonly required
 * on application forms (e.g. privacy policy, data processing).
 *
 * @param {Array} checkboxFields – `fields.checkbox` from `detectFormFields()`
 * @returns {number} Number of checkboxes checked
 */
export function autofillCheckboxes(checkboxFields) {
  let filled = 0

  for (const cb of checkboxFields) {
    const text = [
      cb.name,
      cb.id,
      cb.element.getAttribute('aria-label') || '',
      getCheckboxLabelText(cb.element),
    ]
      .join(' ')
      .toLowerCase()

    // Only auto-check consent / agreement / acknowledgement boxes
    const isConsent =
      text.includes('consent') ||
      text.includes('agree') ||
      text.includes('acknowledge') ||
      text.includes('privacy') ||
      text.includes('terms') ||
      text.includes('data processing') ||
      text.includes('authorization')

    if (isConsent && !cb.element.checked) {
      if (fillField(cb.element, true)) {
        filled += 1
      }
    }
  }

  return filled
}

/**
 * Get visible label text for a checkbox.
 */
function getCheckboxLabelText(element) {
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`)
    if (label) return label.textContent.trim()
  }
  const parentLabel = element.closest('label')
  if (parentLabel) return parentLabel.textContent.trim()
  return ''
}
