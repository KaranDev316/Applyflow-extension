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
  motivationStatement: [
    'why do you want',
    'why are you interested',
    'what excites you',
    'why this role',
    'why this company',
    'why do you want to work here',
    'career goals',
    'motivation',
    'why greenhouse',
    'why apply',
    'why are you applying',
    'why should we hire you',
  ],
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
  timeZone: [
    'time zone',
    'timezone',
    'operating time zone',
    'primary time zone',
    'most commonly operate in',
    'which timezone',
  ],
  salaryAlignment: [
    'comfortable moving forward',
    'comfortable with this range',
    'salary range',
    'pay range',
    'compensation range',
    'compensation expectations',
    'salary expectations',
    'aligned with this range',
    'acceptable compensation',
    'acceptable salary',
  ],
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

function extractSalaryRange(text) {
  if (!text) return null
  const regex = /(?:[$£€]\s*)?(\d+(?:,\d{3})*(?:\.\d+)?)\s*(k)?\s*(?:-|to|–|—)\s*(?:[$£€]\s*)?(\d+(?:,\d{3})*(?:\.\d+)?)\s*(k)?/i
  const match = text.match(regex)
  if (match) {
    let min = parseFloat(match[1].replace(/,/g, ''))
    if (match[2] && match[2].toLowerCase() === 'k') min *= 1000

    let max = parseFloat(match[3].replace(/,/g, ''))
    if (match[4] && match[4].toLowerCase() === 'k') max *= 1000

    if (min < 1000 && max >= 1000) min *= 1000

    return { minSalary: min, maxSalary: max }
  }
  return null
}

function getRawExtendedText(element) {
  const texts = [
    element.name || '',
    element.id || '',
    getAssociatedLabel(element),
    element.placeholder || '',
    element.getAttribute('aria-label') || '',
  ]

  const fieldset = element.closest('fieldset')
  if (fieldset) {
    const legend = fieldset.querySelector('legend')
    if (legend) texts.push(legend.textContent)
  }
  const describedBy = element.getAttribute('aria-describedby')
  if (describedBy) {
    describedBy.split(/\s+/).forEach((id) => {
      const descEl = document.getElementById(id)
      if (descEl) texts.push(descEl.textContent)
    })
  }
  const wrapper = element.closest('.field, .application-field, .form-group, .posting-question, [role="group"]')
  if (wrapper) {
    texts.push(wrapper.textContent)
  }
  return texts.join(' ')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect all relevant form fields on the current page.
 *
 * @returns {{ name: Array, motivationStatement: Array, timeZone: Array, preferredFirstName: Array, preferredLastName: Array, firstName: Array, lastName: Array, email: Array, phone: Array,
 *             address: Array, city: Array, state: Array, country: Array, postalCode: Array,
 *             linkedin: Array, github: Array, portfolio: Array, website: Array, currentCompany: Array,
 *             resume: Array, textarea: Array, select: Array, checkbox: Array }}
 */
export function detectFormFields() {
  const fields = {
    name: [],
    motivationStatement: [],
    timeZone: [],
    salaryAlignment: [],
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

    const rawExtendedText = getRawExtendedText(input)
    const lowerExtendedText = rawExtendedText.toLowerCase()

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
    } else if (matchesKeywords(text, FIELD_KEYWORDS.motivationStatement)) {
      fields.motivationStatement.push(info)
    } else if (matchesKeywords(text, FIELD_KEYWORDS.currentCompany)) {
      fields.currentCompany.push(info)
    } else if (matchesKeywords(text, FIELD_KEYWORDS.name)) {
      fields.name.push(info)
    } else if (matchesKeywords(text, FIELD_KEYWORDS.timeZone)) {
      fields.timeZone.push(info)
    } else if (matchesKeywords(lowerExtendedText, FIELD_KEYWORDS.salaryAlignment)) {
      const range = extractSalaryRange(rawExtendedText)
      if (range) {
        info.extractedMinSalary = range.minSalary
        info.extractedMaxSalary = range.maxSalary
        fields.salaryAlignment.push(info)
      }
    }
  })

  // --- Textareas ---
  const textareas = document.querySelectorAll('textarea')
  textareas.forEach((ta) => {
    const text = getSearchableText(ta)
    const info = buildFieldInfo(ta)
    if (matchesKeywords(text, FIELD_KEYWORDS.motivationStatement)) {
      fields.motivationStatement.push(info)
    } else {
      fields.textarea.push(info)
    }
  })

  // --- Select / Dropdown ---
  const selects = document.querySelectorAll('select')
  selects.forEach((sel) => {
    const text = getSearchableText(sel)
    const info = buildFieldInfo(sel)
    info.options = Array.from(sel.options).map((opt) => ({
      value: opt.value,
      text: opt.textContent.trim(),
    }))

    const rawExtendedText = getRawExtendedText(sel)
    const lowerExtendedText = rawExtendedText.toLowerCase()

    if (matchesKeywords(lowerExtendedText, FIELD_KEYWORDS.salaryAlignment)) {
      const range = extractSalaryRange(rawExtendedText)
      if (range) {
        info.extractedMinSalary = range.minSalary
        info.extractedMaxSalary = range.maxSalary
        fields.salaryAlignment.push(info)
      }
    } else if (matchesKeywords(text, FIELD_KEYWORDS.timeZone)) {
      fields.timeZone.push(info)
    }

    fields.select.push(info)
  })

  // --- Checkboxes ---
  const checkboxes = document.querySelectorAll('input[type="checkbox"]')
  checkboxes.forEach((cb) => {
    const info = buildFieldInfo(cb)
    fields.checkbox.push(info)
  })

  // --- Radio Buttons ---
  const radios = Array.from(document.querySelectorAll('input[type="radio"]'))
  const radioGroups = new Map()
  radios.forEach((radio) => {
    const groupKey = radio.name || radio.closest('.field, .application-field, .form-group, .posting-question, [role="group"]') || radio
    if (!radioGroups.has(groupKey)) {
      radioGroups.set(groupKey, [])
    }
    radioGroups.get(groupKey).push(radio)
  })

  radioGroups.forEach((group) => {
    const firstRadio = group[0]
    const rawText = getRawExtendedText(firstRadio)
    
    if (matchesKeywords(rawText.toLowerCase(), FIELD_KEYWORDS.salaryAlignment)) {
      const range = extractSalaryRange(rawText)
      if (range) {
        const info = buildFieldInfo(firstRadio)
        info.type = 'radio-group'
        info.extractedMinSalary = range.minSalary
        info.extractedMaxSalary = range.maxSalary
        info.radioElements = group
        fields.salaryAlignment.push(info)
      }
    }
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
