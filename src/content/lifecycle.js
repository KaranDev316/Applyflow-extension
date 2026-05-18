export function markContentScriptLoaded() {
  const wasContentScriptLoaded = globalThis.__APPLYFLOW_CONTENT_SCRIPT_LOADED__ === true

  if (wasContentScriptLoaded) {
    console.log('ApplyFlow content script already loaded; skipping duplicate listener')
  } else {
    globalThis.__APPLYFLOW_CONTENT_SCRIPT_LOADED__ = true
    console.log('ApplyFlow content script loaded')
  }

  return wasContentScriptLoaded
}

export function logPageState(eventName, extra = {}) {
  console.log('ApplyFlow:', eventName, {
    href: window.location.href,
    readyState: document.readyState,
    time: Math.round(performance.now()),
    ...extra,
  })
}
