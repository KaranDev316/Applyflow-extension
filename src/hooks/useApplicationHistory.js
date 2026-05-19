import { useCallback, useEffect, useState } from 'react'
import {
  getApplicationHistory,
  deleteApplicationRecord,
} from '../storage/applicationHistory'

export function useApplicationHistory() {
  const [applications, setApplications] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const history = await getApplicationHistory()
      setApplications(history)
      setError('')
    } catch (err) {
      console.error('Failed to load application history:', err)
      setError('Unable to load application history')
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        const history = await getApplicationHistory()
        if (isMounted) {
          setApplications(history)
        }
      } catch (err) {
        console.error('Failed to load application history:', err)
        if (isMounted) {
          setError('Unable to load application history')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    load()

    return () => {
      isMounted = false
    }
  }, [])

  const removeApplication = useCallback(async (id) => {
    try {
      const removed = await deleteApplicationRecord(id)
      if (removed) {
        setApplications((prev) => prev.filter((app) => app.id !== id))
      } else {
        // Record not found in storage — remove from local state anyway
        setApplications((prev) => prev.filter((app) => app.id !== id))
        console.warn('Application record not found in storage:', id)
      }
    } catch (err) {
      console.error('Failed to delete application record:', err)
      setError('Failed to delete application')
    }
  }, [])

  return {
    applications,
    error,
    isLoading,
    refresh,
    removeApplication,
  }
}
