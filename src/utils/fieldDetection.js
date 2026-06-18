/**
 * Field detection utilities for Greenhouse and Lever application forms.
 *
 * Detects: text inputs, email, tel, url, textarea, select, and checkbox fields.
 */

// ---------------------------------------------------------------------------
// Keyword matchers – each field type has a list of substrings that are checked
// against a field's name, id, placeholder, label, and aria-label.
// ---------------------------------------------------------------------------

const FIELD_KEYWORDS = {
  preferredFirstName: ['preferred first name', 'preferred name', 'chosen name', 'nickname'],
  preferredLastName: ['preferred last name', 'preferred surname', 'preferred family name'],
  firstName: ['legal first name', 'first name', 'firstname', 'first_name', 'given name', 'given_name', 'forename'],
  lastName: ['legal last name', 'last name', 'lastname', 'last_name', 'surname', 'family name', 'family_name'],
  name: ['name', 'full name', 'fullname', 'full_name'],
  email: ['email'],
  phone: ['phone', 'telephone', 'mobile'],
  address: ['address', 'street'],
  city: ['city'],
  state: ['state', 'province', 'region'],
  country: ['country'],
  postalCode: ['postal', 'zip'],
  linkedin: ['linkedin'],
  github: ['github'],
  portfolio: ['portfolio'],
  website: ['website', 'personal site', 'personal website'],
  currentCompany: ['current company', 'current employer', 'employer', 'company'],
  resume: ['resume', 'cv'],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the visible label text associated with an input element.
 * Checks for a `<label for="...">` first, then a wrapping `<label>`.
 */
function getAssociatedLabel(input) {
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`)
    if (label) return label.textContent.trim()
  }

  const parentLabel = input.closest('label')
  if (parentLabel) return parentLabel.textContent.trim()

  return ''
}

/**
 * Gather all searchable identifiers for a form element into a single
 * lower-cased string so keyword matching can be done with one `includes`.
 */
function getSearchableText(element) {
  return [
    element.name || '',
    element.id || '',
    getAssociatedLabel(element),
    element.placeholder || '',
    element.getAttribute('aria-label') || '',
  ]
    .join(' ')
    .toLowerCase()
}

/**
 * Check whether any of the given keywords appear in the searchable text.
 */
function matchesKeywords(searchableText, keywords) {
  return keywords.some((kw) => searchableText.includes(kw))
}

/**
 * Build a lightweight info object for a detected element.
 */
function buildFieldInfo(element) {
  return {
    element,
    name: element.name || '',
    id: element.id || '',
    placeholder: element.placeholder || '',
    type: element.type || element.tagName.toLowerCase(),
    tagName: element.tagName.toLowerCase(),
    value: element.type === 'checkbox' ? element.checked : element.value,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect all relevant form fields on the current page.
 *
 * @returns {{ name: Array, preferredFirstName: Array, preferredLastName: Array, firstName: Array, lastName: Array, email: Array, phone: Array,
 *             address: Array, city: Array, state: Array, country: Array, postalCode: Array,
 *             linkedin: Array, github: Array, portfolio: Array, website: Array, currentCompany: Array,
 *             resume: Array, textarea: Array, select: Array, checkbox: Array }}
 */
export function detectFormFields() {
  const fields = {
    name: [],
    preferredFirstName: [],
    preferredLastName: [],
    firstName: [],
    lastName: [],
    email: [],
    phone: [],
    address: [],
    city: [],
    state: [],
    country: [],
    postalCode: [],
    linkedin: [],
    github: [],
    portfolio: [],
    website: [],
    currentCompany: [],
    resume: [],
    textarea: [],
    select: [],
    checkbox: [],
  }

  // --- Text-like inputs (text, email, url, tel) ---
  const textInputs = Array.from(document.querySelectorAll([
    'input:not([type])',
    'input[type="text"]',
    'input[type="email"]',
    'input[type="url"]',
    'input[type="tel"]',
    'input[role="combobox"]',
    'input[aria-autocomplete]',
    'input[aria-controls]',
    '[role="combobox"]',
    '[aria-autocomplete]',
    '[aria-controls]',
    '[class*="react-select" i]',
    '[class*="MuiAutocomplete" i]',
    '[class*="MuiSelect" i]',
  ].join(',')))
    .filter((input, index, inputs) => inputs.indexOf(input) === index)

  textInputs.forEach((input) => {
    const text = getSearchableText(input)
    const info = buildFieldInfo(input)

    if (input.type === 'email' || matchesKeywords(text, FIELD_KEYWORDS.email)) {
      fields.email.push(info)
    } else if (input.type === 'tel' || matchesKeywords(text, FIELD_KEYWORDS.phone)) {
      fields.phone.push(info)
    } else if (matchesKeywords(text, FIELD_KEYWORDS.preferredFirstName)) {
      fields.preferredFirstName.push(info)
    } else if (matchesKeywords(text, FIELD_KEYWORDS.preferredLastName)) {
      fields.preferredLastName.push(info)
    } else if (matchesKeywords(text, FIELD_KEYWORDS.firstName)) {
      fields.firstName.push(info)
    } else if (matchesKeywords(text, FIELD_KEYWORDS.lastName)) {
      fields.lastName.push(info)
    } else if (matchesKeywords(text, FIELD_KEYWORDS.address)) {
      fields.address.push(info)
    } else if (matchesKeywords(text, FIELD_KEYWORDS.city)) {
      fields.city.push(info)
    } else if (matchesKeywords(text, FIELD_KEYWORDS.state)) {
      fields.state.push(info)
    } else if (matchesKeywords(text, FIELD_KEYWORDS.country)) {
      fields.country.push(info)
    } else if (matchesKeywords(text, FIELD_KEYWORDS.postalCode)) {
      fields.postalCode.push(info)
    } else if (matchesKeywords(text, FIELD_KEYWORDS.linkedin)) {
      fields.linkedin.push(info)
    } else if (matchesKeywords(text, FIELD_KEYWORDS.github)) {
      fields.github.push(info)
    } else if (matchesKeywords(text, FIELD_KEYWORDS.portfolio)) {
      fields.portfolio.push(info)
    } else if (matchesKeywords(text, FIELD_KEYWORDS.website)) {
      fields.website.push(info)
    } else if (matchesKeywords(text, FIELD_KEYWORDS.currentCompany)) {
      fields.currentCompany.push(info)
    } else if (matchesKeywords(text, FIELD_KEYWORDS.name)) {
      fields.name.push(info)
    }
  })

  // --- Textareas ---
  const textareas = document.querySelectorAll('textarea')
  textareas.forEach((ta) => {
    const info = buildFieldInfo(ta)
    fields.textarea.push(info)
  })

  // --- Select / Dropdown ---
  const selects = document.querySelectorAll('select')
  selects.forEach((sel) => {
    const info = buildFieldInfo(sel)
    info.options = Array.from(sel.options).map((opt) => ({
      value: opt.value,
      text: opt.textContent.trim(),
    }))
    fields.select.push(info)
  })

  // --- Checkboxes ---
  const checkboxes = document.querySelectorAll('input[type="checkbox"]')
  checkboxes.forEach((cb) => {
    const info = buildFieldInfo(cb)
    fields.checkbox.push(info)
  })

  // --- File inputs (resume / CV) ---
  const fileInputs = document.querySelectorAll('input[type="file"]')
  fileInputs.forEach((input) => {
    const text = getSearchableText(input)
    if (matchesKeywords(text, FIELD_KEYWORDS.resume)) {
      fields.resume.push({
        element: input,
        name: input.name,
        id: input.id,
        type: 'file',
      })
    }
  })

  return fields
}

/**
 * Format detected fields for safe logging (strips DOM element references).
 */
export function formatFieldsForLogging(fields) {
  const summary = {}

  Object.entries(fields).forEach(([fieldType, fieldList]) => {
    summary[fieldType] = fieldList.map((field) => ({
      name: field.name,
      id: field.id,
      type: field.type,
      placeholder: field.placeholder,
    }))
  })

  return summary
}
