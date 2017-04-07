import { polygonCentroid, polygonArea } from 'd3-polygon'

export default (polygon, r, object = {}) => {
  const [x, y] = polygonCentroid(polygon)
  r = r != null ? r : Math.sqrt(polygonArea(polygon) / Math.PI)
  return Object.assign(object, { x, y, r })
}
