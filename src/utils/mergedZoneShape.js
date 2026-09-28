// Renders a merged multi-rect zone (e.g. two touching "БАР" labels fused into
// one Г-shaped object) as a single seamless outline instead of stacking two
// separately-bordered rectangles, which would draw a visible seam between
// them and, if simplified to a bounding box, would also fill in the empty
// notch of the L/T/U shape with color that was never actually part of either
// rectangle.

// Traces the outer boundary of a set of axis-aligned rectangles' union as one
// or more closed polygon loops (each an array of [x, y] points, in the same
// coordinate space as the input rects). Works by rasterizing the rects onto
// the grid formed by their own edges, then walking the cells that sit on the
// covered/uncovered boundary.
export function unionOutline(rects) {
  if (!rects || rects.length === 0) return []
  const xs = [...new Set(rects.flatMap(r => [r.x, r.x + r.width]))].sort((a, b) => a - b)
  const ys = [...new Set(rects.flatMap(r => [r.y, r.y + r.height]))].sort((a, b) => a - b)
  const nx = xs.length - 1
  const ny = ys.length - 1
  if (nx <= 0 || ny <= 0) return []

  const covered = Array.from({ length: nx }, () => Array(ny).fill(false))
  for (const r of rects) {
    const x0 = xs.indexOf(r.x), x1 = xs.indexOf(r.x + r.width)
    const y0 = ys.indexOf(r.y), y1 = ys.indexOf(r.y + r.height)
    for (let i = x0; i < x1; i++) for (let j = y0; j < y1; j++) covered[i][j] = true
  }

  // A unit cell's edge belongs to the outline exactly when the cell on its
  // other side is outside the union (or off the grid entirely).
  const segs = []
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      if (!covered[i][j]) continue
      if (i === 0 || !covered[i - 1][j]) segs.push([[xs[i], ys[j]], [xs[i], ys[j + 1]]])
      if (i === nx - 1 || !covered[i + 1][j]) segs.push([[xs[i + 1], ys[j]], [xs[i + 1], ys[j + 1]]])
      if (j === 0 || !covered[i][j - 1]) segs.push([[xs[i], ys[j]], [xs[i + 1], ys[j]]])
      if (j === ny - 1 || !covered[i][j + 1]) segs.push([[xs[i], ys[j + 1]], [xs[i + 1], ys[j + 1]]])
    }
  }
  return traceLoops(segs)
}

// Walks an unordered soup of boundary unit-segments into closed loops by
// following shared endpoints — every vertex of a simple (non-self-crossing)
// polygon boundary has exactly two incident segments, so from any point the
// "next" segment is just whichever unused one is left.
function traceLoops(segs) {
  const key = ([x, y]) => `${x}:${y}`
  const segObjs = segs.map(([a, b]) => ({ a, b, used: false }))
  const byPoint = new Map()
  for (const s of segObjs) {
    for (const p of [s.a, s.b]) {
      const k = key(p)
      if (!byPoint.has(k)) byPoint.set(k, [])
      byPoint.get(k).push(s)
    }
  }

  const loops = []
  for (const start of segObjs) {
    if (start.used) continue
    const loop = []
    let currentSeg = start
    let currentPoint = start.a
    const startKey = key(currentPoint)
    while (true) {
      currentSeg.used = true
      loop.push(currentPoint)
      const nextPoint = key(currentSeg.a) === key(currentPoint) ? currentSeg.b : currentSeg.a
      currentPoint = nextPoint
      if (key(currentPoint) === startKey) break
      const next = (byPoint.get(key(currentPoint)) || []).find(s => !s.used)
      if (!next) break
      currentSeg = next
    }
    if (loop.length >= 3) loops.push(loop)
  }
  return loops
}

// Where to put the label on a merged zone. An area-weighted centroid of all
// parts sounds right but isn't: for a long thin arm plus a short wide one
// (any real Г/Т/П shape), it lands right on the seam between them, or even
// outside the shape's own arms — visibly crooked. The center of the single
// biggest rectangle is always a real point deep inside the shape, clear of
// every seam and corner, so that's what a viewer actually reads as "centered".
export function zoneCentroid(rects) {
  const biggest = rects.reduce((best, r) => (r.width * r.height > best.width * best.height ? r : best), rects[0])
  return { x: biggest.x + biggest.width / 2, y: biggest.y + biggest.height / 2 }
}
