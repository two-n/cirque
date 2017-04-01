# Cirque

Utilities for negotiating between circles and polygons in SVG, using D3. `npm install cirque`


## Functions

### geoToCircle

Converts the geometry to a _circle object_ centered on the shape's centroid.

_Circle objects_ take the form: `{ x, y, r }`

Positional arguments:
- geometry: any GeoJSON geometry or feature (required)
- path: [geographic path generator](https://github.com/d3/d3-geo#geoPath). Defaults to bare `d3.geoPath()`, which assumes pre-projected geometry
- radius: circle radius. Defaults to computing radius from path.area(geometry)
- object: mutates passed object rather than creating a new one

### circlePath

Converts the passed _circle object_ to an SVG path string (i.e. a _circle path_ consisting of two arc commands).

### interpolatePath

Interpolates between two SVG path strings. Supports _circle paths_ (which are sampled) and polygons (which are oversampled when necessary).

### interpolatePaths

Individually interpolates (using `interpolatePath`) between corresponding items in two parallel arrays of SVG path strings.

### avoidOverlap

Pass an array of _circle objects_ to separate colliding circles so that no overlaps remain. Uses `d3.forceCollide`. Mutates objects in place.

### radiusScale

Receives total area and total value as arguments, and returns a D3 scale in which the area of a circle with the given radius linearly corresponds to a value.



## Examples
```js
let render  // Given a function that renders a set of SVG paths
let path    // Given a geo path generator
```

### Example: geometry
```js
let geometry  // Given a GeoJSON Polygon or MultiPolygon geometry

const interpolator = interpolatePath(
  path(geometry),
  circlePath( geoToCircle(geometry, path) )
)

d3.transition().tween('shape', () => t => { render([ interpolator(t) ]) })
```

### Example: features

```js
let features  // Given an array of GeoJSON Polygon or MultiPolygon features

const scale = radiusScale( path.area(mergedFeatures), 7.5e9 )
const circles = features.map(feature =>
  geoToCircle(feature, path, scale(feature.properties['population']))
)

const separatedCircles = avoidOverlap(circles)
const circlePaths = separatedCircles.map(circlePath)
const interpolator = interpolatePaths(features.map(path), circlePaths)

d3.transition().tween('shapes', () => t => { render( interpolator[i](t) ) })
```
