import GovMap from './components/GovMap.jsx'

// The token is injected at build time from the VITE_GOVMAP_TOKEN env var.
// Vite only exposes variables prefixed with VITE_ to client code.
const TOKEN = import.meta.env.VITE_GOVMAP_TOKEN

// Files live in /public; resolve them against the configured base so they load
// both locally and when deployed under a sub-path (e.g. GitHub Pages).
const BASE = import.meta.env.BASE_URL
const GEOJSON_URLS = [
  `${BASE}mismatch_neighborhoods.geojson`,
  `${BASE}mismatch_kalpi.geojson`,
]

export default function App() {
  return (
    <div className="app">
      <header className="app__header">
        <h1>GovMap Demo</h1>
        <p>שכבות GeoJSON המוצגות באמצעות govmap.displayGeometries</p>
      </header>

      <main className="app__main">
        <GovMap
          token={TOKEN}
          layers={[]}
          geojsonUrls={GEOJSON_URLS}
          options={{ showXY: true, identifyOnClick: true, zoomButtons: true }}
          className="app__map"
        />
      </main>
    </div>
  )
}
