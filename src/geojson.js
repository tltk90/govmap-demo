// Parses GeoJSON into the shape `govmap.displayGeometries` expects.
//
// The GeoJSON in /public is stored in Web Mercator (EPSG:3857) — coordinates
// look like [3881355.6, 3770546.2]. GovMap's displayGeometries expects WKT in
// the Israeli TM Grid (ITM / EPSG:2039), so every coordinate is reprojected on
// the fly here. Nothing about the data is hardcoded: colours, labels and
// geometries are all read from each feature.

import proj4 from 'proj4'

// EPSG:3857 ships with proj4; EPSG:2039 (Israel 1993 / Israeli TM Grid) does not.
proj4.defs(
  'EPSG:2039',
  '+proj=tmerc +lat_0=31.7343936111111 +lon_0=35.2045169444444 ' +
    '+k=1.00000670000001 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 ' +
    '+towgs84=-24.0024,-17.1032,-17.8444,-0.33077,-1.85269,1.66969,5.4262 ' +
    '+units=m +no_defs',
)

const MERCATOR = 'EPSG:3857'
const ITM = 'EPSG:2039'

// [lng, lat] Web Mercator -> "east north" ITM, formatted for WKT.
function toItm([x, y]) {
  const [e, n] = proj4(MERCATOR, ITM, [x, y])
  return `${e.toFixed(2)} ${n.toFixed(2)}`
}

function ringToWkt(ring) {
  return `(${ring.map(toItm).join(', ')})`
}

function polygonToWkt(rings) {
  return `POLYGON(${rings.map(ringToWkt).join(', ')})`
}

// "#f25454" -> [242, 84, 84]
function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '')
  if (h.length < 6) return [242, 84, 84]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

// Polygon symbol: translucent fill in the feature colour with a solid outline.
function polygonSymbol(color) {
  const [r, g, b] = hexToRgb(color)
  return {
    fillColor: [r, g, b, 0.5],
    outlineColor: [r, g, b, 1],
    outlineWidth: 2,
  }
}

// displayGeometries point symbols are images, so we render a small coloured
// circle as an inline SVG data URI keyed off the feature colour.
function pointSymbol(color) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">` +
    `<circle cx="8" cy="8" r="6" fill="${color}" fill-opacity="0.6" stroke="#000" stroke-width="1"/>` +
    `</svg>`
  return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, width: 16, height: 16 }
}

function labelFor(props, index) {
  const town = props?.['שם ישוב']
  const name = props?.neighborhood_name
  const parts = [town, name].filter(Boolean)
  const base = parts.length ? parts.join(' · ') : `feature ${index}`
  // Names must be unique for the API's bubbles; suffix keeps duplicates apart.
  return `${base} #${index}`
}

// Human-readable Hebrew labels for the raw mismatch_type codes in the data.
export const MISMATCH_LABELS = {
  outside: 'קלפי מחוץ לכל השכונות',
  mismatch: 'שכונה מועמדת שאינה מותאמת',
}

// HTML template shown in the click bubble; {0}..{5} are filled per geometry
// from the bubbleHTMLParameters row built in `featureMeta`. {0} is the title.
//
// The title is rendered here (in the body) rather than via displayGeometries'
// `headers` field on purpose. govmap keeps only a single active `headers`
// array (the last call's) and indexes it by each geometry's index WITHIN ITS
// OWN call — so with two layers (polygons + points) no single `headers` array
// can title both correctly (points' local indices collide with polygons').
// bubbleHTMLParameters, by contrast, are indexed per call, so the title stays
// correct for every geometry in every layer.
export const BUBBLE_HTML =
  '<div style="direction:rtl;text-align:right;font-family:system-ui,sans-serif;min-width:220px;line-height:1.6">' +
  '<div style="font-weight:700;font-size:16px;margin-bottom:8px">{0}</div>' +
  '<div><b>סוג אי-התאמה:</b> {1}</div>' +
  '<div><b>סיבה:</b> {2}</div>' +
  '<div><b>קוד יישוב:</b> {3}</div>' +
  '<div><b>שכונה:</b> {4}</div>' +
  '<div><b>ריכוז:</b> {5}</div>' +
  '</div>'

// Extracts what the tooltip (hover) and bubble (click) should show for a
// feature, straight from its properties — nothing is hardcoded per feature.
function featureMeta(props) {
  const town = props['שם ישוב'] || ''
  const code = props.SETL_CODE
  const neighborhood = props.neighborhood_name || ''
  const cluster = props['ריכוז']
  const type = props.mismatch_type || ''
  const typeLabel = MISMATCH_LABELS[type] || type || '—'
  const dash = (v) => (v === undefined || v === null || v === '' ? '—' : String(v))

  const header = [town, code != null ? `(${code})` : ''].filter(Boolean).join(' ') || '—'

  return {
    // header: bubble title (rendered as {0} of the body); tooltip: hover text.
    header,
    tooltip: [town, typeLabel].filter(Boolean).join(' — '),
    // Order must match the {0}..{5} placeholders in BUBBLE_HTML ({0} = title).
    params: [header, typeLabel, dash(props.reason), dash(code), dash(neighborhood), dash(cluster)],
  }
}

// Splits a FeatureCollection into per-geometry-type payloads (displayGeometries
// takes a single geometryType per call). MultiPolygons are flattened into their
// constituent polygons.
//
// `filter` is an optional predicate(props) -> boolean; features for which it
// returns false are skipped. The forEach index still advances over skipped
// features, so the labels of the remaining ones stay unique.
export function toDisplayGroups(featureCollection, filter = null) {
  const points = emptyGroup()
  const polygons = emptyGroup()

  const features = featureCollection?.features ?? []
  features.forEach((feature, index) => {
    const geom = feature?.geometry
    if (!geom) return
    const props = feature.properties ?? {}
    if (filter && !filter(props)) return
    const meta = featureMeta(props)

    if (geom.type === 'Point') {
      pushFeature(points, `POINT(${toItm(geom.coordinates)})`, labelFor(props, index), pointSymbol(props.color), meta)
    } else if (geom.type === 'Polygon') {
      pushFeature(polygons, polygonToWkt(geom.coordinates), labelFor(props, index), polygonSymbol(props.color), meta)
    } else if (geom.type === 'MultiPolygon') {
      geom.coordinates.forEach((rings, part) => {
        pushFeature(polygons, polygonToWkt(rings), `${labelFor(props, index)}.${part}`, polygonSymbol(props.color), meta)
      })
    }
  })

  return { points, polygons }
}

function emptyGroup() {
  return { wkts: [], names: [], symbols: [], tooltips: [], headers: [], bubbleParams: [] }
}

function pushFeature(group, wkt, name, symbol, meta) {
  group.wkts.push(wkt)
  group.names.push(name)
  group.symbols.push(symbol)
  group.tooltips.push(meta.tooltip)
  group.headers.push(meta.header)
  group.bubbleParams.push(meta.params)
}

// Rough ITM centre of every coordinate in a FeatureCollection, used to centre
// the map on the data. Returns null when there is nothing to centre on.
export function centerOf(featureCollection) {
  let sumX = 0
  let sumY = 0
  let count = 0

  const visit = (coords) => {
    // Leaf coordinate pair.
    if (typeof coords[0] === 'number') {
      const [e, n] = proj4(MERCATOR, ITM, coords)
      sumX += e
      sumY += n
      count += 1
      return
    }
    coords.forEach(visit)
  }

  for (const feature of featureCollection?.features ?? []) {
    if (feature?.geometry?.coordinates) visit(feature.geometry.coordinates)
  }

  if (!count) return null
  return { x: sumX / count, y: sumY / count }
}
