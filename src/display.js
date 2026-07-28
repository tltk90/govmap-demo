// Fetches GeoJSON files from /public and draws them with govmap.displayGeometries.

import { BUBBLE_HTML, centerOf, toDisplayGroups } from './geojson.js'

// An empty accumulator with the same shape as a toDisplayGroups group.
function emptyMerge() {
  return { wkts: [], names: [], symbols: [], tooltips: [], headers: [], bubbleParams: [] }
}

// Appends every parallel array of `src` onto `dst`, keeping them aligned.
function mergeInto(dst, src) {
  dst.wkts.push(...src.wkts)
  dst.names.push(...src.names)
  dst.symbols.push(...src.symbols)
  dst.tooltips.push(...src.tooltips)
  dst.headers.push(...src.headers)
  dst.bubbleParams.push(...src.bubbleParams)
}

// Fetches every url and returns the parsed FeatureCollections, in order.
// Kept separate from drawing so the same data can be re-drawn (e.g. when the
// user toggles a filter) without re-fetching.
export async function loadGeojson(urls) {
  const fcs = []
  for (const url of urls) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to load ${url} (${response.status})`)
    fcs.push(await response.json())
  }
  return fcs
}

// Draws already-loaded FeatureCollections, optionally filtered.
//
// govmap needs one displayGeometries call per geometryType, so we merge every
// file into one polygon group + one point group and draw each type once
// (polygons first so points render on top). Titles are carried in each layer's
// bubbleHTMLParameters (see BUBBLE_HTML) rather than the `headers` field —
// govmap keeps only the last call's `headers` and indexes it per-call, so it
// cannot title two layers correctly; bubbleHTMLParameters can.
//
// Options:
//   filter - predicate(props) -> boolean; features returning false are skipped.
//            Omit/null to draw everything.
//   fit    - when true, zoom/centre the map on the (unfiltered) data. Used on
//            the first draw only, so a filter toggle doesn't yank the viewport.
export async function drawGeojson(govmap, fcs, { filter = null, fit = false } = {}) {
  const allPolys = emptyMerge()
  const allPoints = emptyMerge()
  let sumX = 0
  let sumY = 0
  let centers = 0

  for (const fc of fcs) {
    const { points, polygons } = toDisplayGroups(fc, filter)
    mergeInto(allPolys, polygons)
    mergeInto(allPoints, points)

    if (fit) {
      const c = centerOf(fc)
      if (c) {
        sumX += c.x
        sumY += c.y
        centers += 1
      }
    }
  }

  // Polygons first so points render on top of them.
  const layers = []
  if (allPolys.wkts.length) layers.push({ group: allPolys, geometryType: govmap.geometryType.POLYGON })
  if (allPoints.wkts.length) layers.push({ group: allPoints, geometryType: govmap.geometryType.POINT })

  // Nothing to draw (e.g. every type filtered out): wipe the previous render.
  if (!layers.length) {
    await clearGeometries(govmap)
    return
  }

  for (let i = 0; i < layers.length; i++) {
    const { group, geometryType } = layers[i]
    await govmap.displayGeometries({
      wkts: group.wkts,
      names: group.names,
      geometryType,
      symbols: group.symbols,
      clearExisting: i === 0,
      showBubble: true,
      data: {
        tooltips: group.tooltips,
        bubbleHTML: BUBBLE_HTML,
        bubbleHTMLParameters: group.bubbleParams,
      },
    })
  }

  if (fit && centers) {
    govmap.zoomToXY({ x: sumX / centers, y: sumY / centers, level: 5, marker: false })
  }
}

// Removes all previously drawn geometries. Uses govmap.clearGeometries when the
// API exposes it, otherwise overwrites the map with an empty polygon layer.
async function clearGeometries(govmap) {
  if (typeof govmap.clearGeometries === 'function') {
    return govmap.clearGeometries()
  }
  return govmap.displayGeometries({
    wkts: [],
    names: [],
    geometryType: govmap.geometryType.POLYGON,
    symbols: [],
    clearExisting: true,
  })
}
