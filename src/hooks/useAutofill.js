import { useEffect, useRef, useState } from 'react'
import { isContentScriptActive, triggerAutofillOnPage } from '../utils/messaging'

export function useAutofill({
  isPlatformSupported,
  onMetadata,
  onSuccess,
  platformName,
}) {
  const [autofillStatus, setAutofillStatus] = useState('idle')
  const [autofillMessage, setAutofillMessage] = useState('')
  const [isAutofilling, setIsAutofilling] = useState(false)
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const autofillMessageTimeoutRef = useRef(null)

  useEffect(() => (
    () => {
      window.clearTimeout(autofillMessageTimeoutRef.current)
    }
  ), [])

  const showAutofillMessage = (message, type) => {
    window.clearTimeout(autofillMessageTimeoutRef.current)
    setAutofillMessage(message)
    setAutofillStatus(type)

    autofillMessageTimeoutRef.current = window.setTimeout(() => {
      setAutofillMessage('')
      setAutofillStatus('idle')
    }, 3000)
  }

  const handleAutofill = async () => {
    // If the bridge was broken on the last click, execute a programmatic reload now
    if (needsRefresh) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.reload(tabs[0].id)
        }
      })
      return
    }

    if (!isPlatformSupported) {
      showAutofillMessage('Unsupported platform', 'error')
      return
    }

    setIsAutofilling(true)
    setAutofillStatus('loading')
    setAutofillMessage('')

    try {
      console.log('Popup: Triggering autofill for platform:', platformName)

      const contentScriptActive = await isContentScriptActive()

      if (!contentScriptActive) {
        setNeedsRefresh(true)
        showAutofillMessage('Connection lost. Click again to reload page.', 'error')
        return
      }

      const result = await triggerAutofillOnPage()

      console.log('Popup: Autofill result:', result)

      if (result.success) {
        showAutofillMessage(`✓ Filled ${result.filledCount} field(s)`, 'success')

        if (result.metadata) {
          onMetadata(result.metadata)
        }

        await onSuccess()
      } else if (result.duplicate) {
        showAutofillMessage('Autofill already in progress', 'error')
      } else {
        showAutofillMessage(result.error || 'Failed to autofill form', 'error')
      }
    } catch (error) {
      console.error('Popup: Autofill error:', error)
      showAutofillMessage('Failed to autofill form', 'error')
    } finally {
      setIsAutofilling(false)
    }
  }

  return {
    autofillMessage,
    autofillStatus,
    handleAutofill,
    isAutofilling,
    needsRefresh,
  }
}
