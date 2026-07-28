import { useEffect, useRef, useState } from 'react'
import { loadGovMap } from '../govmap.js'
import { drawGeojson, loadGeojson } from '../display.js'
import { MISMATCH_LABELS } from '../geojson.js'

// The mismatch types the user can filter by. `outside` = kalpi points sitting
// outside every neighborhood; `mismatch` = candidate neighborhood polygons.
const MISMATCH_TYPES = ['outside', 'mismatch']

// Renders a GovMap map into a div via `govmap.createMap`.
//
// Props:
//   token        - GovMap API token (domain-specific). Required by the API.
//   layers       - array of layer identifiers to display (empty by default).
//   geojsonUrls  - GeoJSON files to fetch and draw via displayGeometries once
//                  the map is ready.
//   options      - any extra options forwarded to govmap.createMap (showXY,
//                  identifyOnClick, zoomButtons, background, layersMode, ...).
export default function GovMap({ token, layers = [], geojsonUrls = [], options = {}, className, style }) {
  const containerRef = useRef(null)
  // The DOM id createMap needs. Stable across renders.
  const mapIdRef = useRef('govmap-container')
  // Guards against React 18 StrictMode double-invoking this effect in dev:
  // createMap is imperative and NOT idempotent, so a second interleaved run
  // corrupts govmap's geometry/headers alignment. Init once.
  const initedRef = useRef(false)
  // Live govmap instance + the fetched FeatureCollections, so filter toggles can
  // redraw without re-creating the map or re-fetching the data.
  const govmapRef = useRef(null)
  const fcsRef = useRef(null)
  // Fit the viewport to the data on the first draw only; a filter toggle should
  // not yank the map back to centre.
  const didFitRef = useRef(false)
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [error, setError] = useState(null)
  // Which mismatch types are currently shown. Both on by default.
  const [enabled, setEnabled] = useState({ outside: true, mismatch: true })

  useEffect(() => {
    // Init exactly once. createMap is imperative and not idempotent, so we must
    // not run it twice (React 18 StrictMode invokes effects twice in dev). No
    // cancel flag: the map lives for the component's lifetime, and a cancel here
    // would abort the only init before it finishes.
    if (initedRef.current) return
    initedRef.current = true

    if (!token) {
      setStatus('error')
      setError(
        'No GovMap token provided. Set VITE_GOVMAP_TOKEN in your .env file (see .env.example).',
      )
      return
    }

    loadGovMap()
      .then((govmap) => {
        govmapRef.current = govmap
        return govmap
          .createMap(mapIdRef.current, {
            token,
            layers,
            showXY: true,
            identifyOnClick: true,
            zoomButtons: true,
            ...options,
          })
          .then(() => govmap)
      })
      .then(async () => {
        // Fetch the data now; the draw effect renders it once status is 'ready'.
        if (geojsonUrls.length) fcsRef.current = await loadGeojson(geojsonUrls)
        setStatus('ready')
      })
      .catch((err) => {
        console.error('GovMap init failed:', err)
        setStatus('error')
        setError(err?.message ?? String(err))
      })
    // Re-run only if the token identity changes; layers/options are read at init.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Draw (and redraw on filter change) once the map is ready and data loaded.
  useEffect(() => {
    if (status !== 'ready') return
    const govmap = govmapRef.current
    const fcs = fcsRef.current
    if (!govmap || !fcs) return

    const allowed = new Set(MISMATCH_TYPES.filter((t) => enabled[t]))
    const filter = (props) => allowed.has(props.mismatch_type)
    const fit = !didFitRef.current
    didFitRef.current = true

    drawGeojson(govmap, fcs, { filter, fit }).catch((err) => {
      console.error('GovMap draw failed:', err)
    })
  }, [status, enabled])

  const toggle = (type) => setEnabled((prev) => ({ ...prev, [type]: !prev[type] }))

  return (
    <div className={className} style={{ position: 'relative', ...style }}>
      <div id={mapIdRef.current} ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {status === 'ready' && <FilterPanel enabled={enabled} onToggle={toggle} />}

      {status === 'loading' && <Overlay>טוען מפה…</Overlay>}
      {status === 'error' && (
        <Overlay tone="error">
          <strong>שגיאה בטעינת המפה</strong>
          <div style={{ marginTop: 8, fontSize: 14, direction: 'ltr', textAlign: 'left' }}>{error}</div>
        </Overlay>
      )}
    </div>
  )
}

// Checkboxes for filtering the map by mismatch type.
function FilterPanel({ enabled, onToggle }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
        direction: 'rtl',
        background: 'rgba(255,255,255,0.95)',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        padding: '10px 14px',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        color: '#334155',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>סינון אי-התאמות</div>
      {MISMATCH_TYPES.map((type) => (
        <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '2px 0' }}>
          <input type="checkbox" checked={enabled[type]} onChange={() => onToggle(type)} />
          <span>{MISMATCH_LABELS[type]}</span>
        </label>
      ))}
    </div>
  )
}

function Overlay({ children, tone }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: 24,
        textAlign: 'center',
        background: tone === 'error' ? 'rgba(255,241,241,0.96)' : 'rgba(248,250,252,0.9)',
        color: tone === 'error' ? '#991b1b' : '#334155',
        pointerEvents: 'none',
      }}
    >
      {children}
    </div>
  )
}
