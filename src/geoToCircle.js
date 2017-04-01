import { geoPath } from 'd3-geo'

export default (geometry, path, r, object = {}) => {
  const [x, y] = path.centroid(geometry)
  path = path != null ? path : geoPath()
  r = r != null ? r : Math.sqrt(path.area(geometry) / Math.PI)
  return Object.assign(object, { x, y, r })
}
