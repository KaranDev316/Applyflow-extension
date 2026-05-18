/**
 * Field detection utilities for Greenhouse and Lever application forms
 */

/**
 * Detect form fields on the page
 * @returns {object} Detected fields with their properties
 */
export function detectFormFields() {
  const fields = {
    name: [],
    email: [],
    linkedin: [],
    phone: [],
    resume: [],
  }

  // Detect input fields
  const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="url"], input[type="tel"], textarea')

  inputs.forEach((input) => {
    const name = (input.name || '').toLowerCase()
    const id = (input.id || '').toLowerCase()
    const placeholder = (input.placeholder || '').toLowerCase()
    const label = getAssociatedLabel(input)?.toLowerCase() || ''
    const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase()

    const fieldInfo = {
      element: input,
      name: input.name,
      id: input.id,
      placeholder: input.placeholder,
      type: input.type,
      value: input.value,
    }

    // Check for name field
    if (
      name.includes('name') ||
      id.includes('name') ||
      placeholder.includes('name') ||
      label.includes('name') ||
      ariaLabel.includes('name')
    ) {
      fields.name.push(fieldInfo)
    }

    // Check for email field
    if (
      input.type === 'email' ||
      name.includes('email') ||
      id.includes('email') ||
      placeholder.includes('email') ||
      label.includes('email') ||
      ariaLabel.includes('email')
    ) {
      fields.email.push(fieldInfo)
    }

    // Check for LinkedIn field
    if (
      name.includes('linkedin') ||
      id.includes('linkedin') ||
      placeholder.includes('linkedin') ||
      label.includes('linkedin') ||
      ariaLabel.includes('linkedin')
    ) {
      fields.linkedin.push(fieldInfo)
    }

    // Check for phone field
    if (
      input.type === 'tel' ||
      name.includes('phone') ||
      name.includes('telephone') ||
      id.includes('phone') ||
      placeholder.includes('phone') ||
      label.includes('phone') ||
      ariaLabel.includes('phone')
    ) {
      fields.phone.push(fieldInfo)
    }
  })

  // Detect file inputs (resume/CV)
  const fileInputs = document.querySelectorAll('input[type="file"]')
  fileInputs.forEach((input) => {
    const name = (input.name || '').toLowerCase()
    const id = (input.id || '').toLowerCase()
    const placeholder = (input.placeholder || '').toLowerCase()
    const label = getAssociatedLabel(input)?.toLowerCase() || ''
    const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase()

    if (
      name.includes('resume') ||
      name.includes('cv') ||
      id.includes('resume') ||
      id.includes('cv') ||
      placeholder.includes('resume') ||
      label.includes('resume') ||
      ariaLabel.includes('resume') ||
      label.includes('cv') ||
      ariaLabel.includes('cv')
    ) {
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
 * Get the associated label for an input element
 * @param {HTMLElement} input - The input element
 * @returns {string} The label text or empty string
 */
function getAssociatedLabel(input) {
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`)
    if (label) return label.textContent.trim()
  }

  // Check parent label
  const parentLabel = input.closest('label')
  if (parentLabel) return parentLabel.textContent.trim()

  return ''
}

/**
 * Format detected fields for logging
 * @param {object} fields - Detected fields object
 * @returns {object} Formatted fields summary
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
