import { geoPath } from 'd3-geo'

export default (geometry, path, r, object = {}) => {
  path = path != null ? path : geoPath()
  const [x, y] = path.centroid(geometry)
  r = r != null ? r : Math.sqrt(path.area(geometry) / Math.PI)
  return Object.assign(object, { x, y, r, clockwise: true })
}
