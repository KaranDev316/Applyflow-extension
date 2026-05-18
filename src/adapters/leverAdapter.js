export const leverAdapter = {
  id: 'lever',
  name: 'Lever',
  matchesUrl(url) {
    return /lever\.co/i.test(url)
  },
}
