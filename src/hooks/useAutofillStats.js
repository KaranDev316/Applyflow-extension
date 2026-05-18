import { useCallback, useEffect, useState } from 'react'
import { getAutofillStats } from '../utils/autofillStats'

export function useAutofillStats() {
  const [autofillStatsData, setAutofillStatsData] = useState(null)

  const refreshStats = useCallback(async () => {
    try {
      const stats = await getAutofillStats()
      setAutofillStatsData(stats)
      return stats
    } catch (statsError) {
      console.warn('Failed to load autofill stats:', statsError)
      return null
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadStats() {
      try {
        const stats = await getAutofillStats()
        if (isMounted) {
          setAutofillStatsData(stats)
        }
      } catch (statsError) {
        console.warn('Failed to load autofill stats:', statsError)
      }
    }

    loadStats()

    return () => {
      isMounted = false
    }
  }, [])

  return {
    autofillStatsData,
    refreshStats,
  }
}
