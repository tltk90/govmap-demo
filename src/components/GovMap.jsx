import { useEffect, useRef, useState } from 'react'
import { loadGovMap } from '../govmap.js'
import { drawGeojsonFiles } from '../display.js'

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
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    if (!token) {
      setStatus('error')
      setError(
        'No GovMap token provided. Set VITE_GOVMAP_TOKEN in your .env file (see .env.example).',
      )
      return
    }

    let govmapRef = null

    loadGovMap()
      .then((govmap) => {
        if (cancelled) return
        govmapRef = govmap
        return govmap.createMap(mapIdRef.current, {
          token,
          layers,
          showXY: true,
          identifyOnClick: true,
          zoomButtons: true,
          ...options,
        })
      })
      .then(() => {
        if (cancelled || !govmapRef || !geojsonUrls.length) return
        return drawGeojsonFiles(govmapRef, geojsonUrls)
      })
      .then(() => {
        if (!cancelled) setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        console.error('GovMap init failed:', err)
        setStatus('error')
        setError(err?.message ?? String(err))
      })

    return () => {
      cancelled = true
    }
    // Re-run only if the token identity changes; layers/options are read at init.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <div className={className} style={{ position: 'relative', ...style }}>
      <div id={mapIdRef.current} ref={containerRef} style={{ width: '100%', height: '100%' }} />

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
