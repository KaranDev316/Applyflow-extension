import { greenhouseAdapter } from './greenhouseAdapter'
import { leverAdapter } from './leverAdapter'

export const platformAdapters = [
  greenhouseAdapter,
  leverAdapter,
]

export function getAdapterForUrl(url) {
  return platformAdapters.find((adapter) => adapter.matchesUrl(url)) || null
}
