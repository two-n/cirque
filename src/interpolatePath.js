import { range, mean, scan, descending } from 'd3-array'
import { interpolate } from 'd3-interpolate'
import { polygonCentroid } from 'd3-polygon'

const isCircle = d => Boolean(d.match(/a/i))

const distance = (pt1, pt2) => Math.pow(pt1[0] - pt2[0], 2) + Math.pow(pt1[1] - pt2[1], 2),
      midpoint = (pt1, pt2) => [(pt1[0] + pt2[0]) / 2, (pt1[1] + pt2[1]) / 2]
const computeGaps = points =>
  range(0, points.length).map(i =>
    distance(points[i], points[(i + 1) % points.length])
  )
const addPoint = (points, gaps) => {
  const i = scan(gaps || computeGaps(points), descending)
  points.splice(i + 1, 0, midpoint(points[i], points[(i + 1) % points.length]))
  if (gaps != null) {
    gaps[i] = distance(points[i], points[(i + 1) % points.length])
    gaps[i + 1] = distance(points[i + 1], points[(i + 2) % points.length])
  }
}
const oversamplePath = (originalPoints, numPoints) => {
  const points = [].concat(originalPoints)
  while (numPoints > points.length) addPoint(points)
  return points
}

const angleTowards = (pt1, pt2) =>
  Math.atan2(pt2[1] - pt1[1], pt2[0] - pt1[0]) + Math.PI/2

const project = (c, angle) =>
  [c.x + c.r * Math.sin(angle), c.y + c.r * -Math.cos(angle)]
const sampleCircle = (c, numSamples, offset) =>
  range(0, numSamples).map(i => project(c, i/numSamples * 2*Math.PI + offset))

const MIN_SAMPLE_DISTANCE = 1
const circumference = circle => 2 * Math.PI * circle.r


const processShape = d => {
  if (isCircle(d)) {
    const r = +d.match(/A ([-\d\.]+)/)[1],
          start = d.match(/M ([-\d\.]+) ([-\d\.]+)/).slice(1).map(Number),
          circle = { r, x: start[0], y: start[1] + r }
    return { circle, numPoints: Math.ceil(circumference(circle) / MIN_SAMPLE_DISTANCE) }
  }
  else {
    // const points = d.slice(1)
    //   .replace(/Z/g,'')
    //   .split(/L|M/)
    //   .map(d => d.split(',').map(Number))
    const polygons = d.slice(1)
      .replace(/Z/g,'')
      .split(/M/)
      .map(polygon => polygon.split(/L/))
    const polygonIndex = scan(polygons, (a, b) => descending(a.length, b.length))
    const points = polygons[polygonIndex].map(d => d.split(",").map(Number))

    const gaps = computeGaps(points)
    let [g1, ...gRest] = [].concat(gaps).sort(descending)
    while (g1 > 5 * mean(gRest)) {
      addPoint(points, gaps)
      ;[g1, ...gRest] = [].concat(gaps).sort(descending)
    }

    return {
      points,
      numPoints: points.length,
      offset: angleTowards(polygonCentroid(points), points[0])
    }
  }
}

const generateShape = numPoints => d =>
  `M ${(d.circle != null ? sampleCircle : oversamplePath)(d.circle || d.points, numPoints, d.offset || 0).join("L")} Z`


export default (a, b) => {
  const shapes = [a, b].map(processShape)

  let interpolatePath

  // If both are circles, use an ordinary (not sampled) interpolation
  if (shapes[0].circle != null && shapes[1].circle != null) {
    interpolatePath = interpolate(a, b)
  }
  else {
    shapes[0].offset == null && (shapes[0].offset = shapes[1].offset)
    shapes[1].offset == null && (shapes[1].offset = shapes[0].offset)

    // TODO handle case where both are paths

    const shapeGenerator = generateShape(Math.max(...shapes.map(d => d.numPoints)))
    interpolatePath = interpolate( ...shapes.map(shapeGenerator) )
  // const interpolateCentroid = interpolate(a.centroid, b.centroid)
  }

  if (a === b) return () => b
  return t => t === 1 ? b : interpolatePath(t)
}
