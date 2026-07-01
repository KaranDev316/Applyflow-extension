/**
 * Smart Autofill Engine
 *
 * Maps saved profile data to detected form fields and fills them using the
 * right interaction model for the element type. Modern job boards often use
 * custom dropdown/autocomplete widgets, so dropdown-like fields are filled by
 * clicking, typing, waiting for options, selecting, and verifying.
 */

const DROPDOWN_TIMEOUT_MS = 3000
const DROPDOWN_POLL_MS = 100
const MAX_DROPDOWN_RETRIES = 3
const TYPING_DELAY_MIN_MS = 20
const TYPING_DELAY_MAX_MS = 60

const VALIDATION_PATTERNS = [
  /select a .+/i,
  /please enter .+/i,
  /required field/i,
  /this field is required/i,
]

const DROPDOWN_OPTION_SELECTORS = [
  '[role="option"]',
  '[role="listbox"] [role="option"]',
  '[role="listbox"] li',
  '.MuiAutocomplete-option',
  '.react-select__option',
  '[class*="option" i]',
  '[id*="listbox" i] li',
  'ul li',
]

const CUSTOM_SELECT_INDICATORS = [
  'react-select',
  'muiautocomplete',
  'muiselect',
  'listbox',
  'combobox',
  'autocomplete',
]

// ---------------------------------------------------------------------------
// Event helpers
// ---------------------------------------------------------------------------

function getView(element) {
  return element?.ownerDocument?.defaultView || window
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function randomTypingDelay() {
  return TYPING_DELAY_MIN_MS + Math.floor(Math.random() * (TYPING_DELAY_MAX_MS - TYPING_DELAY_MIN_MS + 1))
}

function dispatchInputEvents(element) {
  const View = getView(element)
  element.dispatchEvent(new View.Event('input', { bubbles: true }))
  element.dispatchEvent(new View.Event('change', { bubbles: true }))
}

function dispatchTextInputEvent(element, char) {
  const View = getView(element)
  if (typeof View.InputEvent === 'function') {
    element.dispatchEvent(new View.InputEvent('input', {
      bubbles: true,
      cancelable: true,
      data: char,
      inputType: 'insertText',
    }))
    return
  }

  element.dispatchEvent(new View.Event('input', { bubbles: true }))
}

function dispatchKeyboardEvent(element, type, key) {
  const View = getView(element)
  element.dispatchEvent(new View.KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    key,
  }))
}

function dispatchMouseEvent(element, type) {
  const View = getView(element)
  element.dispatchEvent(new View.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: View,
  }))
}

function clickLikeUser(element) {
  if (!element) return
  dispatchMouseEvent(element, 'mousedown')
  dispatchMouseEvent(element, 'mouseup')
  dispatchMouseEvent(element, 'click')
}

function focusElement(element) {
  const View = getView(element)
  element.focus?.()
  element.dispatchEvent(new View.Event('focus', { bubbles: true }))
}

function blurElement(element) {
  const View = getView(element)
  element.blur?.()
  element.dispatchEvent(new View.Event('blur', { bubbles: true }))
}

function setNativeValue(element, value) {
  const View = getView(element)
  const isTextInput = element instanceof View.HTMLInputElement
  const isTextArea = element instanceof View.HTMLTextAreaElement
  const proto = isTextArea
    ? View.HTMLTextAreaElement.prototype
    : isTextInput
      ? View.HTMLInputElement.prototype
      : null

  if (!proto) {
    if (element.isContentEditable) {
      element.textContent = value
      return
    }
    return
  }

  const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set

  if (nativeSetter) {
    nativeSetter.call(element, value)
  } else {
    element.value = value
  }
}

async function typeHuman(element, value) {
  if (!element) return false

  focusElement(element)
  clickLikeUser(element)
  setNativeValue(element, '')
  dispatchInputEvents(element)

  let current = ''
  for (const char of String(value)) {
    dispatchKeyboardEvent(element, 'keydown', char)
    dispatchKeyboardEvent(element, 'keypress', char)
    current += char
    setNativeValue(element, current)
    dispatchTextInputEvent(element, char)
    dispatchKeyboardEvent(element, 'keyup', char)
    await delay(randomTypingDelay())
  }

  const View = getView(element)
  element.dispatchEvent(new View.Event('change', { bubbles: true }))
  return true
}

// ---------------------------------------------------------------------------
// Detection and matching
// ---------------------------------------------------------------------------

export function detectFieldType(element) {
  if (!element?.tagName) return 'text'

  const tag = element.tagName.toLowerCase()
  const role = (element.getAttribute('role') || '').toLowerCase()
  const ariaAutocomplete = element.getAttribute('aria-autocomplete')
  const ariaControls = element.getAttribute('aria-controls')
  const classText = [
    element.className || '',
    element.closest?.('[class]')?.className || '',
    element.parentElement?.className || '',
  ]
    .join(' ')
    .toLowerCase()
  const attributeText = [
    role,
    ariaAutocomplete || '',
    ariaControls || '',
    element.getAttribute('aria-haspopup') || '',
  ]
    .join(' ')
    .toLowerCase()
  const indicatorText = `${classText} ${attributeText}`

  if (tag === 'select') return 'native-select'
  if (tag === 'textarea') return 'textarea'
  if (role === 'combobox') return 'combobox'
  if (ariaAutocomplete || ariaControls) return 'autocomplete'
  if (CUSTOM_SELECT_INDICATORS.some((indicator) => indicatorText.includes(indicator))) {
    return 'custom-select'
  }

  return 'text'
}

export function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s,._\-()[\]{}:+/\\|'"`~!@#$%^&*?;]+/g, '')
}

function scoreOption(optionText, desiredValue) {
  if (Array.isArray(desiredValue)) {
    return Math.max(...desiredValue.map((val) => scoreOption(optionText, val)))
  }

  const normalizedOption = normalize(optionText)
  const normalizedDesired = normalize(desiredValue)

  if (!normalizedOption || !normalizedDesired) return 0
  if (normalizedOption === normalizedDesired) return 100
  if (normalizedOption.includes(normalizedDesired)) return 85
  if (normalizedDesired.includes(normalizedOption)) return 70

  const desiredTokens = String(desiredValue).toLowerCase().split(/[\s,._\-()[\]{}:+/\\|'"`~!@#$%^&*?;]+/).filter(Boolean)
  const optionLower = String(optionText).toLowerCase()
  const matchedTokens = desiredTokens.filter((token) => optionLower.includes(token)).length

  return desiredTokens.length > 0 ? Math.round((matchedTokens / desiredTokens.length) * 60) : 0
}

function isVisible(element) {
  if (!element || !element.isConnected) return false
  const style = getView(element).getComputedStyle?.(element)
  if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) return false
  const rect = element.getBoundingClientRect?.()
  return !rect || rect.width > 0 || rect.height > 0 || Boolean(element.textContent?.trim())
}

function getDropdownOptions(root = document) {
  return DROPDOWN_OPTION_SELECTORS
    .flatMap((selector) => Array.from(root.querySelectorAll(selector)))
    .filter((option, index, options) => options.indexOf(option) === index)
    .filter((option) => isVisible(option) && option.textContent?.trim())
}

export async function waitForDropdown(root = document, timeoutMs = DROPDOWN_TIMEOUT_MS) {
  const startedAt = Date.now()

  while (Date.now() - startedAt <= timeoutMs) {
    const options = getDropdownOptions(root)
    if (options.length > 0) return options
    await delay(DROPDOWN_POLL_MS)
  }

  return []
}

function findBestOption(options, value) {
  return options
    .map((option) => ({
      option,
      score: scoreOption(option.textContent || option.getAttribute('aria-label') || '', value),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((first, second) => second.score - first.score)[0]?.option || null
}

function findComboboxInput(element) {
  if (!element) return null
  if (element.matches?.('input, textarea')) return element
  const input = element.querySelector?.('input, textarea, [contenteditable="true"]')
  if (input) return input

  const controls = element.getAttribute?.('aria-controls')
  if (!controls) return null

  return element.ownerDocument
    .getElementById(controls)
    ?.querySelector?.('input, textarea, [contenteditable="true"]') || null
}

function hasBlockingValidation(element) {
  if (element.getAttribute?.('aria-invalid') === 'true') return true

  const describedBy = element.getAttribute?.('aria-describedby')
  if (describedBy) {
    const hasDescribedError = describedBy
      .split(/\s+/)
      .some((id) => {
        const node = element.ownerDocument.getElementById(id)
        return node && isVisible(node) && VALIDATION_PATTERNS.some((pattern) => pattern.test(node.textContent || ''))
      })
    if (hasDescribedError) return true
  }

  const container = element.closest?.('label, div, section, form') || element.ownerDocument.body
  const validationText = container?.textContent || ''
  return VALIDATION_PATTERNS.some((pattern) => pattern.test(validationText)) && element.getAttribute?.('aria-invalid') === 'true'
}

function verifySelection(element, value) {
  if (hasBlockingValidation(element)) return false

  const text = [
    element.value || '',
    element.textContent || '',
    element.getAttribute?.('aria-label') || '',
  ].join(' ')

  if (Array.isArray(value)) {
    return value.some((val) => {
      const desired = normalize(val)
      return !desired || normalize(text).includes(desired)
    })
  }

  const desired = normalize(value)
  return !desired || normalize(text).includes(desired)
}

// ---------------------------------------------------------------------------
// Per-type fill handlers
// ---------------------------------------------------------------------------

function fillTextInput(element, value) {
  focusElement(element)
  setNativeValue(element, value)
  dispatchInputEvents(element)
  blurElement(element)
  return true
}

function fillNativeSelect(element, value) {
  if (!value || (Array.isArray(value) && value.length === 0)) return false

  const options = Array.from(element.options)
  const match = findBestOption(options, value)
  if (!match) return false

  element.value = match.value
  dispatchInputEvents(element)
  return element.value === match.value
}

function fillCheckbox(element, value) {
  const desired = Boolean(value)
  if (element.checked !== desired) {
    clickLikeUser(element)
    if (element.checked !== desired) {
      element.checked = desired
    }
    dispatchInputEvents(element)
  }
  return true
}

function fillRadioGroup(elements, value) {
  if (!elements || elements.length === 0) return false
  
  const desired = normalize(value)
  let match = null
  for (const radio of elements) {
    const labelText = normalize(getAssociatedLabelText(radio) || radio.value)
    if (labelText === desired || labelText.includes(desired)) {
      match = radio
      break
    }
  }
  
  if (match && !match.checked) {
    clickLikeUser(match)
    if (!match.checked) {
      match.checked = true
    }
    dispatchInputEvents(match)
    return true
  }
  
  return false
}

async function keyboardSelect(element) {
  dispatchKeyboardEvent(element, 'keydown', 'ArrowDown')
  dispatchKeyboardEvent(element, 'keyup', 'ArrowDown')
  await delay(50)
  dispatchKeyboardEvent(element, 'keydown', 'Enter')
  dispatchKeyboardEvent(element, 'keyup', 'Enter')
  await delay(100)
}

async function fillAutocomplete(element, value) {
  const input = findComboboxInput(element)
  const interactionTarget = input || element
  const maxAttempts = input ? MAX_DROPDOWN_RETRIES : 1

  const typeValue = Array.isArray(value) ? value[0] : String(value)

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    focusElement(interactionTarget)
    clickLikeUser(interactionTarget)

    if (input) {
      await typeHuman(input, typeValue)
    } else {
      for (const char of String(typeValue)) {
        dispatchKeyboardEvent(interactionTarget, 'keydown', char)
        dispatchKeyboardEvent(interactionTarget, 'keypress', char)
        dispatchKeyboardEvent(interactionTarget, 'keyup', char)
      }
    }

    const options = await waitForDropdown(element.ownerDocument)
    const bestOption = findBestOption(options, value)

    if (bestOption && attempt !== 2) {
      clickLikeUser(bestOption)
      await delay(150)
      if (verifySelection(input || element, value)) return true
    }

    await keyboardSelect(interactionTarget)
    if (verifySelection(input || element, value)) return true

    if (attempt === maxAttempts && bestOption) {
      focusElement(interactionTarget)
      clickLikeUser(interactionTarget)
      clickLikeUser(bestOption)
      await delay(150)
      if (verifySelection(input || element, value)) return true
    }
  }

  return false
}

// ---------------------------------------------------------------------------
// Profile ↔ Field mapping
// ---------------------------------------------------------------------------

const PROFILE_FIELD_MAP = [
  { profileKey: 'application.motivationStatement', fieldCategory: 'motivationStatement' },
  { profileKey: 'personal.preferredFirstName', fieldCategory: 'preferredFirstName' },
  { profileKey: 'personal.firstName', fieldCategory: 'firstName' },
  { profileKey: 'personal.lastName', fieldCategory: 'preferredLastName' },
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
  { profileKey: 'preferences.timeZone', fieldCategory: 'timeZone' },
  { profileKey: 'preferences.minimumSalary', fieldCategory: 'salaryAlignment' },
]

const TIMEZONE_MAPPINGS = {
  PT: ['pacific', 'pacific time', 'pst', 'pdt'],
  MT: ['mountain', 'mountain time', 'mst', 'mdt'],
  CT: ['central', 'central time', 'cst', 'cdt'],
  ET: ['eastern', 'eastern time', 'est', 'edt'],
}

function getProfileValue(profile, path) {
  if (path === 'name') {
    const legacyName = profile?.name
    if (legacyName) return legacyName

    return [profile?.personal?.preferredFirstName || profile?.personal?.firstName, profile?.personal?.lastName]
      .filter(Boolean)
      .join(' ')
  }

  let value = path.split('.').reduce((current, key) => current?.[key], profile)

  // Fallback to legal first name if a preferred first name isn't set
  if (path === 'personal.preferredFirstName' && !value) {
    value = profile?.personal?.firstName
  }

  // Handle structured validation objects for location and phone
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (path.includes('phone')) {
      value = value.e164 || value.nationalNumber || value
    } else {
      value = value.name || value
    }
  }

  return Array.isArray(value) ? value.join(', ') : value
}

function getLegacyProfileValue(profile, path) {
  const legacyKey = path.split('.').at(-1)
  return profile?.[legacyKey]
}

function hasNonEmptyValue(value) {
  return value !== undefined && value !== null && String(value).trim().length > 0
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fillField(element, value, fieldInfo = null) {
  if (!element?.isConnected) return false
  if (value === undefined || value === null || value === '') return false
  if (Array.isArray(value) && value.length === 0) return false

  const tag = element.tagName.toLowerCase()
  const fieldType = fieldInfo?.type || detectFieldType(element)

  // Do not overwrite existing user input
  if ((tag === 'input' && element.type !== 'checkbox' && element.type !== 'radio') || tag === 'textarea') {
    if (hasNonEmptyValue(element.value)) return false
  }
  if (fieldType === 'native-select') {
    if (hasNonEmptyValue(element.value)) return false
  }
  if (fieldType === 'combobox' || fieldType === 'autocomplete' || fieldType === 'custom-select') {
    const input = findComboboxInput(element)
    if (input && hasNonEmptyValue(input.value)) return false
  }
  if (fieldType === 'radio-group' && fieldInfo?.radioElements) {
    if (fieldInfo.radioElements.some((r) => r.checked)) return false
  }

  try {
    if (fieldType === 'radio-group' && fieldInfo?.radioElements) {
      return fillRadioGroup(fieldInfo.radioElements, value)
    }

    if (fieldType === 'native-select') {
      return fillNativeSelect(element, value)
    }

    if (tag === 'input' && element.type === 'checkbox') {
      return fillCheckbox(element, value)
    }

    if (fieldType === 'combobox' || fieldType === 'autocomplete' || fieldType === 'custom-select') {
      return fillAutocomplete(element, value)
    }

    if (fieldType === 'textarea' || tag === 'input') {
      const textValue = Array.isArray(value) ? String(value[0]) : String(value)
      return fillTextInput(element, textValue)
    }

    console.warn('ApplyFlow: Skipping unsupported element', tag, element)
    return false
  } catch (err) {
    console.warn('ApplyFlow: Error filling field', element, err)
    return false
  }
}

export async function autofillFromProfile(profile, fields) {
  const details = []
  let filledCount = 0
  let skippedCount = 0

  for (const { profileKey, fieldCategory } of PROFILE_FIELD_MAP) {
    const rawValue = getProfileValue(profile, profileKey) || getLegacyProfileValue(profile, profileKey)
    const candidates = fields[fieldCategory]

    if ((rawValue === undefined || rawValue === null || rawValue === '') || !candidates || candidates.length === 0) {
      skippedCount += 1
      details.push({ field: fieldCategory, status: 'skipped', reason: (rawValue === undefined || rawValue === null || rawValue === '') ? 'empty_value' : 'no_match' })
      continue
    }

    const target = candidates[0]
    let fillValue = rawValue

    if (fieldCategory === 'timeZone' && TIMEZONE_MAPPINGS[rawValue]) {
      const fieldType = detectFieldType(target.element)
      if (['native-select', 'combobox', 'autocomplete', 'custom-select'].includes(fieldType)) {
        fillValue = TIMEZONE_MAPPINGS[rawValue]
      }
    }

    if (fieldCategory === 'salaryAlignment') {
      if (rawValue === null || rawValue === undefined || rawValue === '') {
        skippedCount += 1
        details.push({ field: fieldCategory, status: 'skipped', reason: 'no_minimum_salary_set' })
        continue
      }

      const minSalary = Number(rawValue)
      if (isNaN(minSalary)) {
        skippedCount += 1
        details.push({ field: fieldCategory, status: 'skipped', reason: 'invalid_minimum_salary' })
        continue
      }

      const { extractedMaxSalary } = target
      if (!extractedMaxSalary) {
        skippedCount += 1
        details.push({ field: fieldCategory, status: 'skipped', reason: 'no_salary_extracted' })
        continue
      }

      fillValue = extractedMaxSalary >= minSalary ? 'Yes' : 'No'
    }

    const filled = await fillField(target.element, fillValue, target)

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
    profile?.phone?.e164 || profile?.phone?.nationalNumber || profile?.phone,
    profile?.linkedin,
    profile?.personal?.firstName,
    profile?.personal?.lastName,
    profile?.personal?.preferredFirstName,
    profile?.personal?.email,
    profile?.personal?.phone?.e164 || profile?.personal?.phone?.nationalNumber || profile?.personal?.phone,
    profile?.location?.address,
    profile?.location?.city?.name || profile?.location?.city,
    profile?.location?.state?.name || profile?.location?.state,
    profile?.location?.country?.name || profile?.location?.country,
    profile?.location?.postalCode,
    profile?.professional?.currentCompany,
    profile?.social?.linkedin,
    profile?.social?.github,
    profile?.social?.portfolio,
    profile?.social?.website,
    ...(profile?.professional?.skills || []),
  ]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')

  const options = Array.from(element.options)
  const match = candidates
    .map((candidate) => findBestOption(options, candidate))
    .find(Boolean)

  return match?.textContent || match?.value || null
}

export async function autofillSelects(selectFields, profile) {
  let filled = 0

  for (const sel of selectFields) {
    const text = [sel.name, sel.id, sel.element.getAttribute('aria-label') || '', getAssociatedLabelText(sel.element)]
      .join(' ')
      .toLowerCase()

    const email = profile?.personal?.email || profile?.email
    const phoneObj = profile?.personal?.phone || profile?.phone
    const phone = phoneObj?.e164 || phoneObj?.nationalNumber || phoneObj

    if (text.includes('phone') && phone) {
      continue
    }

    const matchingValue = selectHasExactProfileValue(sel.element, profile)

    if (matchingValue && await fillField(sel.element, matchingValue)) {
      filled += 1
      continue
    }

    const contactMode = text.includes('contact') || text.includes('preferred method')
    if (contactMode && email) {
      if (await fillField(sel.element, 'Email')) {
        filled += 1
        continue
      }
      if (await fillField(sel.element, 'email')) {
        filled += 1
        continue
      }
    }

    if (contactMode && phone) {
      if (await fillField(sel.element, 'Phone')) {
        filled += 1
        continue
      }
      if (await fillField(sel.element, 'phone')) {
        filled += 1
        continue
      }
    }
  }

  return filled
}

export async function autofillCheckboxes(checkboxFields) {
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

    const isConsent =
      text.includes('consent') ||
      text.includes('agree') ||
      text.includes('acknowledge') ||
      text.includes('privacy') ||
      text.includes('terms') ||
      text.includes('data processing') ||
      text.includes('authorization')

    if (isConsent && !cb.element.checked) {
      if (await fillField(cb.element, true)) {
        filled += 1
      }
    }
  }

  return filled
}

function getCheckboxLabelText(element) {
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`)
    if (label) return label.textContent.trim()
  }
  const parentLabel = element.closest('label')
  if (parentLabel) return parentLabel.textContent.trim()
  return ''
}
