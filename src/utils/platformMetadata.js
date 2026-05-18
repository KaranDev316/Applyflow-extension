/**
 * Platform metadata configuration for supported job application sites
 */

export const PLATFORMS = {
  GREENHOUSE: {
    id: 'greenhouse',
    name: 'Greenhouse',
    urlPattern: /greenhouse\.io/i,
    supported: true,
  },
  LEVER: {
    id: 'lever',
    name: 'Lever',
    urlPattern: /lever\.co/i,
    supported: true,
  },
}

export const SUPPORTED_PLATFORMS = Object.values(PLATFORMS).filter(
  (platform) => platform.supported,
)

/**
 * Get platform by ID
 * @param {string} platformId - Platform identifier
 * @returns {object|null} Platform metadata or null if not found
 */
export function getPlatformById(platformId) {
  return PLATFORMS[platformId.toUpperCase()] || null
}

/**
 * Get all supported platforms
 * @returns {array} Array of supported platform objects
 */
export function getSupportedPlatforms() {
  return SUPPORTED_PLATFORMS
}

/**
 * Check if a platform is supported
 * @param {string} platformId - Platform identifier
 * @returns {boolean} True if platform is supported
 */
export function isPlatformSupported(platformId) {
  const platform = getPlatformById(platformId)
  return platform ? platform.supported : false
}
