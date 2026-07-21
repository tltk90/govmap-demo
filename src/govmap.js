// Loads the GovMap JavaScript API from the official CDN exactly once and
// resolves with the global `govmap` object once it is ready.
//
// The GovMap docs are explicit that the script must be loaded from their CDN
// and NOT downloaded locally, so we inject the <script> tag at runtime:
// https://api.govmap.gov.il/docs/intro/javascript-functions

const GOVMAP_SRC = 'https://www.govmap.gov.il/govmap/api/govmap.api.js'

let loaderPromise = null

export function loadGovMap() {
  // Already available (e.g. after HMR) — reuse it.
  if (typeof window !== 'undefined' && window.govmap) {
    return Promise.resolve(window.govmap)
  }

  if (loaderPromise) return loaderPromise

  loaderPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GOVMAP_SRC}"]`)

    const onReady = () => {
      if (window.govmap) resolve(window.govmap)
      else reject(new Error('GovMap API script loaded but `govmap` global is missing.'))
    }

    if (existing) {
      if (window.govmap) onReady()
      else existing.addEventListener('load', onReady, { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load GovMap API script.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = GOVMAP_SRC
    script.async = true
    script.addEventListener('load', onReady, { once: true })
    script.addEventListener('error', () => reject(new Error('Failed to load GovMap API script.')), { once: true })
    document.head.appendChild(script)
  })

  return loaderPromise
}
