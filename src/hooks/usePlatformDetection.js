import { useEffect, useState } from 'react'
import { extractMetadataFromPage } from '../utils/messaging'
import { getPlatformStatus } from '../utils/platformDetection'

export function usePlatformDetection() {
  const [platformStatus, setPlatformStatus] = useState(null)
  const [isDetectingPlatform, setIsDetectingPlatform] = useState(true)
  const [jobMetadata, setJobMetadata] = useState(null)
  const isPlatformSupported = platformStatus?.supported === true

  useEffect(() => {
    let isMounted = true

    async function detectPlatform() {
      try {
        const status = await getPlatformStatus()

        if (isMounted) {
          setPlatformStatus(status)
        }

        // Stop showing the detecting state as soon as we have platform status
        if (isMounted) {
          setIsDetectingPlatform(false)
        }

        // If supported, fetch metadata in background without blocking the UI
        if (status?.type === 'supported') {
          (async () => {
            try {
              const metaResult = await extractMetadataFromPage()
              if (isMounted && metaResult?.metadata) {
                setJobMetadata(metaResult.metadata)
              }
            } catch (metaError) {
              console.warn('Failed to extract metadata:', metaError)
            }
          })()
        }
      } catch (error) {
        console.error('Failed to detect platform:', error)
        if (isMounted) {
          setPlatformStatus({
            message: 'Unable to detect platform',
            type: 'error',
            platform: null,
            name: null,
            supported: false,
          })
        }
      }
    }

    detectPlatform()

    return () => {
      isMounted = false
    }
  }, [])

  return {
    isDetectingPlatform,
    isPlatformSupported,
    jobMetadata,
    platformStatus,
    setJobMetadata,
  }
}
