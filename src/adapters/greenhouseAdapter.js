export const greenhouseAdapter = {
  id: 'greenhouse',
  name: 'Greenhouse',
  matchesUrl(url) {
    return /greenhouse\.io/i.test(url)
  },
}
