import { detectFormFields } from '../utils/fieldDetection.js'

const PAGE_READY_DELAY_MS = 250
const FIELD_DETECTION_RETRIES = 10
const FIELD_DETECTION_RETRY_MS = 250
const MUTATION_WAIT_MS = 1500

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export function waitForPageReady() {
  if (document.readyState === 'complete') {
    return new Promise((resolve) => {
      window.setTimeout(resolve, PAGE_READY_DELAY_MS)
    })
  }

  return new Promise((resolve) => {
    window.addEventListener(
      'load',
      () => {
        window.setTimeout(resolve, PAGE_READY_DELAY_MS)
      },
      { once: true },
    )
  })
}

export function waitForDomStable() {
  return new Promise((resolve) => {
    let timer = null
    const quietMs = 200

    const observer = new MutationObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        observer.disconnect()
        resolve()
      }, quietMs)
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    timer = setTimeout(() => {
      observer.disconnect()
      resolve()
    }, quietMs)

    setTimeout(() => {
      observer.disconnect()
      resolve()
    }, MUTATION_WAIT_MS)
  })
}

export function getFieldCount(fields) {
  return Object.values(fields).reduce(
    (total, fieldList) => total + fieldList.length,
    0,
  )
}

export async function detectFieldsWhenReady() {
  let fields = detectFormFields()
  let fieldCount = getFieldCount(fields)

  for (let attempt = 1; fieldCount === 0 && attempt <= FIELD_DETECTION_RETRIES; attempt += 1) {
    console.log('ApplyFlow: No fields detected yet; retrying', {
      attempt,
      href: window.location.href,
      readyState: document.readyState,
    })

    await wait(FIELD_DETECTION_RETRY_MS)
    fields = detectFormFields()
    fieldCount = getFieldCount(fields)
  }

  return { fields, fieldCount }
}
