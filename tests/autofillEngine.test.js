import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { JSDOM } from 'jsdom'

import {
  autofillFromProfile,
  autofillSelects,
  autofillCheckboxes,
  fillField,
} from '../src/utils/autofillEngine.js'
import { detectFormFields } from '../src/utils/fieldDetection.js'

let dom

function setupDom(html = '') {
  dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, {
    url: 'https://example.com',
  })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.HTMLInputElement = dom.window.HTMLInputElement
  globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement
  globalThis.HTMLSelectElement = dom.window.HTMLSelectElement
  globalThis.MutationObserver = dom.window.MutationObserver
  globalThis.Event = dom.window.Event
}

beforeEach(() => {
  setupDom()
})

test('Autofill fills Greenhouse-style fields and preserves dynamic form events', async () => {
  setupDom(`
    <label for="applicant_name">Full name</label>
    <input id="applicant_name" name="applicant_name" type="text" placeholder="Name" />
    <label for="applicant_email">Email</label>
    <input id="applicant_email" name="applicant_email" type="email" />
    <label for="applicant_phone">Phone</label>
    <input id="applicant_phone" name="applicant_phone" type="tel" />
    <label for="cover_letter">Cover letter</label>
    <textarea id="cover_letter" name="cover_letter"></textarea>
    <label for="agreement"><input id="agreement" name="agreement" type="checkbox" /> I agree to the terms</label>
    <label for="contact_method">Contact method</label>
    <select id="contact_method" name="contact_method">
      <option value="">Choose</option>
      <option value="Email">Email</option>
      <option value="Phone">Phone</option>
    </select>
  `)

  const profile = {
    name: 'Ava Greenhouse',
    email: 'ava@greenhouse.example',
    phone: '+15551234567',
    linkedin: 'https://linkedin.com/in/ava',
  }

  const fields = detectFormFields()
  const result = await autofillFromProfile(profile, fields)
  const selectsFilled = await autofillSelects(fields.select, profile)
  const checkboxesFilled = await autofillCheckboxes(fields.checkbox)

  assert.equal(result.filledCount, 3)
  assert.equal(selectsFilled, 1)
  assert.equal(checkboxesFilled, 1)

  const nameInput = document.getElementById('applicant_name')
  const emailInput = document.getElementById('applicant_email')
  const phoneInput = document.getElementById('applicant_phone')
  const textarea = document.getElementById('cover_letter')
  const select = document.getElementById('contact_method')
  const checkbox = document.getElementById('agreement')

  assert.equal(nameInput.value, 'Ava Greenhouse')
  assert.equal(emailInput.value, 'ava@greenhouse.example')
  assert.equal(phoneInput.value, '+15551234567')
  assert.equal(select.value, 'Email')
  assert.equal(checkbox.checked, true)

  let textAreaUpdated = false
  textarea.addEventListener('input', () => {
    textAreaUpdated = true
  })
  await fillField(textarea, 'Hello, I am excited to apply.')
  assert.equal(textarea.value, 'Hello, I am excited to apply.')
  assert.equal(textAreaUpdated, true)
})

test('Autofill detects Lever-style fields and skips unknown elements safely', async () => {
  setupDom(`
    <label for="full_name">Name</label>
    <input id="full_name" name="full_name" type="text" placeholder="Your name" />
    <label for="work_email">Work Email</label>
    <input id="work_email" name="work_email" type="email" />
    <label for="mobile">Mobile</label>
    <input id="mobile" name="mobile" type="tel" />
    <div id="unknown-field">Do not fill me</div>
  `)

  const profile = {
    name: 'Harper Lever',
    email: 'harper@lever.example',
    phone: '555-0199',
    linkedin: '',
  }

  const fields = detectFormFields()
  const result = await autofillFromProfile(profile, fields)

  assert.equal(result.filledCount, 3)
  assert.ok(result.skippedCount >= 1)
  assert.equal(result.details.some((detail) => detail.field === 'linkedin' && detail.status === 'skipped'), true)
  assert.equal(await fillField(document.getElementById('unknown-field'), 'ignored'), false)
})

test('Autofill maps nested profile fields to detailed application fields', async () => {
  setupDom(`
    <label for="first_name">First Name</label>
    <input id="first_name" name="first_name" type="text" />
    <label for="last_name">Last Name</label>
    <input id="last_name" name="last_name" type="text" />
    <label for="email">Email</label>
    <input id="email" name="email" type="email" />
    <label for="address">Address</label>
    <input id="address" name="address" type="text" />
    <label for="city">City</label>
    <input id="city" name="city" type="text" />
    <label for="state">State</label>
    <input id="state" name="state" type="text" />
    <label for="country">Country</label>
    <input id="country" name="country" type="text" />
    <label for="postal_code">Postal Code</label>
    <input id="postal_code" name="postal_code" type="text" />
    <label for="github">GitHub</label>
    <input id="github" name="github" type="url" />
    <label for="portfolio">Portfolio</label>
    <input id="portfolio" name="portfolio" type="url" />
    <label for="website">Website</label>
    <input id="website" name="website" type="url" />
    <label for="current_company">Current Company</label>
    <input id="current_company" name="current_company" type="text" />
  `)

  const profile = {
    personal: {
      firstName: 'Nia',
      lastName: 'Applicant',
      email: 'nia@example.com',
      phone: '',
    },
    location: {
      address: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      country: 'USA',
      postalCode: '94105',
    },
    professional: {
      currentCompany: 'ApplyFlow Labs',
      skills: ['React'],
    },
    social: {
      github: 'https://github.com/nia',
      portfolio: 'https://nia.dev',
      website: 'https://example.com',
    },
  }

  const fields = detectFormFields()
  const result = await autofillFromProfile(profile, fields)

  assert.equal(result.filledCount, 12)
  assert.equal(document.getElementById('first_name').value, 'Nia')
  assert.equal(document.getElementById('last_name').value, 'Applicant')
  assert.equal(document.getElementById('email').value, 'nia@example.com')
  assert.equal(document.getElementById('address').value, '123 Main St')
  assert.equal(document.getElementById('postal_code').value, '94105')
  assert.equal(document.getElementById('github').value, 'https://github.com/nia')
  assert.equal(document.getElementById('current_company').value, 'ApplyFlow Labs')
})

test('Dropdown selections apply correctly with visible text matching', async () => {
  setupDom(`
    <label for="preferred_contact">Preferred contact</label>
    <select id="preferred_contact" name="preferred_contact" aria-label="Preferred contact method">
      <option value="">choose</option>
      <option value="Email">Email</option>
      <option value="Phone">Phone</option>
    </select>
  `)

  const select = document.getElementById('preferred_contact')
  let changeFired = false
  select.addEventListener('change', () => {
    changeFired = true
  })

  assert.equal(await fillField(select, 'Email'), true)
  assert.equal(select.value, 'Email')
  assert.equal(changeFired, true)
})

test('Textareas populate correctly and emit input events', async () => {
  setupDom(`
    <textarea id="cover_story" name="cover_story" placeholder="Tell us about yourself"></textarea>
  `)

  const textarea = document.getElementById('cover_story')
  let inputEvents = 0
  textarea.addEventListener('input', () => {
    inputEvents += 1
  })

  assert.equal(await fillField(textarea, 'My experience is a strong fit.'), true)
  assert.equal(textarea.value, 'My experience is a strong fit.')
  assert.equal(inputEvents, 1)
})

test('Autofill remains stable after page refresh simulation and repeated attempts', async () => {
  setupDom(`
    <label for="candidate_name">Name</label>
    <input id="candidate_name" name="candidate_name" type="text" />
    <label for="candidate_email">Email</label>
    <input id="candidate_email" name="candidate_email" type="email" />
  `)

  const profile = {
    name: 'Taylor Applicant',
    email: 'taylor@applicant.example',
    phone: '',
    linkedin: '',
  }

  const firstFields = detectFormFields()
  const firstResult = await autofillFromProfile(profile, firstFields)
  assert.equal(firstResult.filledCount, 2)

  document.body.innerHTML = ''
  setupDom(`
    <label for="candidate_name">Name</label>
    <input id="candidate_name" name="candidate_name" type="text" />
    <label for="candidate_email">Email</label>
    <input id="candidate_email" name="candidate_email" type="email" />
  `)

  const secondFields = detectFormFields()
  const secondResult = await autofillFromProfile(profile, secondFields)
  assert.equal(secondResult.filledCount, 2)
  assert.deepEqual(firstResult, secondResult)
})

test('Custom combobox without an input selects an option without native value crashes', async () => {
  setupDom(`
    <div id="country" role="combobox" aria-label="Country" tabindex="0">Select a country</div>
    <ul role="listbox" hidden>
      <li role="option">India</li>
      <li role="option">United States</li>
    </ul>
  `)

  const combobox = document.getElementById('country')
  const listbox = document.querySelector('[role="listbox"]')

  combobox.addEventListener('click', () => {
    listbox.hidden = false
  })

  document.querySelectorAll('[role="option"]').forEach((option) => {
    option.addEventListener('click', () => {
      combobox.textContent = option.textContent
      listbox.hidden = true
    })
  })

  assert.equal(await fillField(combobox, 'India'), true)
  assert.equal(combobox.textContent, 'India')
})
