import {
  autofillCheckboxes,
  autofillFromProfile,
  autofillSelects,
} from '../utils/autofillEngine.js'
import { detectFormFields, formatFieldsForLogging } from '../utils/fieldDetection.js'
import { extractPageMetadata } from '../utils/metadataExtractor.js'
import { recordAutofillRun } from '../utils/autofillStats.js'
import { getProfileFromStorage } from '../utils/storageUtil.js'
import { saveDraftApplication } from '../storage/applicationHistory.js'
import { logPageState } from './lifecycle.js'
import {
  detectFieldsWhenReady,
  getFieldCount,
  waitForDomStable,
  waitForPageReady,
} from './readiness.js'

let isAutofillRunning = false

function summarizeProfile(profile) {
  return {
    name: Boolean(profile.name),
    email: Boolean(profile.email),
    phone: Boolean(profile.phone),
    linkedin: Boolean(profile.linkedin),
  }
}

export function handleDetectFields() {
  try {
    const fields = detectFormFields()
    const fieldsLog = formatFieldsForLogging(fields)
    const fieldCount = getFieldCount(fields)

    console.log('ApplyFlow: Detected form fields:', { fieldCount, fields: fieldsLog })

    return {
      success: true,
      fields: fieldsLog,
      fieldCount,
    }
  } catch (error) {
    console.error('ApplyFlow: Error detecting fields:', error)
    return { success: false, error: error.message }
  }
}

export function handleExtractMetadata() {
  try {
    const metadata = extractPageMetadata()
    console.log('ApplyFlow: Extracted metadata:', metadata)
    return { success: true, metadata }
  } catch (error) {
    console.error('ApplyFlow: Metadata extraction error:', error)
    return { success: false, error: error.message, metadata: { company: '', role: '' } }
  }
}

export async function handleAutofill() {
  if (isAutofillRunning) {
    console.warn('ApplyFlow: Autofill already in progress - skipping duplicate request')
    return {
      success: false,
      error: 'Autofill already in progress',
      duplicate: true,
    }
  }

  isAutofillRunning = true

  try {
    logPageState('Autofill requested')

    await waitForPageReady()
    await waitForDomStable()
    logPageState('DOM stable, proceeding with autofill')

    const profile = await getProfileFromStorage()
    console.log('ApplyFlow: Loaded profile summary:', summarizeProfile(profile))

    const { fields, fieldCount } = await detectFieldsWhenReady()
    const fieldsLog = formatFieldsForLogging(fields)

    console.log('ApplyFlow: Starting autofill with detected fields:', { fieldCount, fields: fieldsLog })

    const result = autofillFromProfile(profile, fields)
    const selectsFilled = autofillSelects(fields.select, profile)
    const checkboxesFilled = autofillCheckboxes(fields.checkbox)
    const totalFilled = result.filledCount + selectsFilled + checkboxesFilled
    const metadata = extractPageMetadata()

    console.log('ApplyFlow: Autofill completed', {
      profileFields: result.filledCount,
      selects: selectsFilled,
      checkboxes: checkboxesFilled,
      total: totalFilled,
      metadata,
      details: result.details,
    })

    await recordAutofillRun({ success: true, filledCount: totalFilled }).catch((err) => {
      console.warn('ApplyFlow: Failed to record autofill stats', err)
    })

    // Save or update a DRAFT record after autofill. Do NOT mark as applied.
    // We create a draft when autofill produced fields or when metadata exists
    // so the user can review and submit. The submission detection will
    // upgrade the draft to `applied` when a successful submission is observed.
    try {
      const shouldDraft = totalFilled > 0 || (metadata && (metadata.company || metadata.role))
      if (shouldDraft) {
        const draft = await saveDraftApplication({
          company: metadata.company,
          role: metadata.role,
          url: window.location.href,
        })
        if (draft) {
          console.log('ApplyFlow: Draft saved after autofill', { id: draft.id })
        }
      }
    } catch (err) {
      console.warn('ApplyFlow: Failed to save draft application record', err)
    }

    return {
      success: true,
      filledCount: totalFilled,
      message: `Autofilled ${totalFilled} field(s)`,
      metadata,
      details: result.details,
    }
  } catch (error) {
    console.error('ApplyFlow: Autofill error:', error)

    await recordAutofillRun({ success: false, filledCount: 0 }).catch(() => {})

    return {
      success: false,
      error: error.message,
    }
  } finally {
    isAutofillRunning = false
  }
}
