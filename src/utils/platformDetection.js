/**
 * Platform detection utility for identifying job application sites
 */

import { PLATFORMS } from './platformMetadata.js'

/**
 * Detect platform from URL
 * @param {string} url - The URL to analyze
 * @returns {object} Detection result with platform info and supported status
 *                   { platform: string|null, name: string|null, supported: boolean }
 */
export function detectPlatformFromUrl(url) {
  if (!url) {
    return {
      platform: null,
      name: null,
      supported: false,
    }
  }

  // Check each platform's URL pattern
  for (const [key, platform] of Object.entries(PLATFORMS)) {
    if (platform.urlPattern.test(url)) {
      return {
        platform: platform.id,
        name: platform.name,
        supported: platform.supported,
      }
    }
  }

  return {
    platform: null,
    name: null,
    supported: false,
  }
}

/**
 * Get current active tab URL and detect platform
 * @returns {Promise<object>} Detection result
 *          { platform: string|null, name: string|null, supported: boolean, error: string|null }
 */
export async function detectCurrentTabPlatform() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    if (!tab || !tab.url) {
      return {
        platform: null,
        name: null,
        supported: false,
        error: 'Unable to access current tab URL',
      }
    }

    const detection = detectPlatformFromUrl(tab.url)

    return {
      ...detection,
      error: null,
    }
  } catch (error) {
    console.error('Platform detection error:', error)
    return {
      platform: null,
      name: null,
      supported: false,
      error: error.message || 'Failed to detect platform',
    }
  }
}

/**
 * Get human-readable status message for current tab
 * @returns {Promise<object>} Status object with message and type
 *          { message: string, type: 'supported'|'unsupported'|'error', name: string|null }
 */
export async function getPlatformStatus() {
  const detection = await detectCurrentTabPlatform()

  if (detection.error) {
    return {
      message: detection.error,
      type: 'error',
      name: null,
    }
  }

  if (detection.supported) {
    return {
      message: `✓ ${detection.name} is supported`,
      type: 'supported',
      name: detection.name,
    }
  }

  return {
    message: '⚠ This site is not supported. Please visit Greenhouse or Lever.',
    type: 'unsupported',
    name: null,
  }
}
