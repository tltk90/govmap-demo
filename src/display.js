// Fetches GeoJSON files from /public and draws them with govmap.displayGeometries.

import { BUBBLE_HTML, centerOf, toDisplayGroups } from './geojson.js'

// Draws one group (points or polygons) if it has any geometries. The bubble
// (on click) and tooltip (on hover) explain each feature's mismatch using the
// reason / mismatch_type / SETL_CODE read from its GeoJSON properties.
function drawGroup(govmap, group, geometryType, clearExisting) {
  if (!group.wkts.length) return Promise.resolve()
  return govmap.displayGeometries({
    wkts: group.wkts,
    names: group.names,
    geometryType,
    symbols: group.symbols,
    clearExisting,
    showBubble: true,
    data: {
      tooltips: group.tooltips,
      headers: group.headers,
      bubbleHTML: BUBBLE_HTML,
      bubbleHTMLParameters: group.bubbleParams,
    },
  })
}

// Loads every url, converts each FeatureCollection to WKT and draws it, then
// centres the map on the combined data. `clearExisting` is only set on the very
// first draw so later drawings stack on top instead of wiping the previous ones.
export async function drawGeojsonFiles(govmap, urls) {
  let firstDraw = true
  let sumX = 0
  let sumY = 0
  let centers = 0

  for (const url of urls) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to load ${url} (${response.status})`)
    const fc = await response.json()

    const { points, polygons } = toDisplayGroups(fc)

    // Polygons first so points render on top of them.
    await drawGroup(govmap, polygons, govmap.geometryType.POLYGON, firstDraw)
    firstDraw = firstDraw && !polygons.wkts.length
    await drawGroup(govmap, points, govmap.geometryType.POINT, firstDraw)
    firstDraw = false

    const c = centerOf(fc)
    if (c) {
      sumX += c.x
      sumY += c.y
      centers += 1
    }
  }

  if (centers) {
    govmap.zoomToXY({ x: sumX / centers, y: sumY / centers, level: 5, marker: false })
  }
}
