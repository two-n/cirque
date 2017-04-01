# Cirque

Utility functions for negotiating between circles and polygons in SVG, using D3.


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

Interpolates between SVG paths strings. Supports _circle paths_, which are sampled, and polygons, which are oversampled if necessary.

### interpolatePaths

Individually interpolates (using `interpolatePath`) between corresponding items in parallel arrays of SVG path strings.

### avoidOverlap

Pass an array of _circle objects_ to separate colliding circles so that no overlaps remain. Uses `d3.forceCollide`. Mutates objects in place.

### radiusScale

Receives total area and total value as arguments, and returns a d3 scale in which the radius corresponds to a linear value.



## Examples
```
let path  // Given a [geo path generator](https://github.com/d3/d3-geo#geoPath)
let render  // Given a function that renders a set of SVG paths
```

### Example: geometry
```
let geometry  // Given a GeoJSON Polygon or MultiPolygon geometry

const interpolator = **interpolatePath**(
  path(geometry),
  **circlePath**(**geoToCircle**(geometry, path))
)

d3.transition().tween('shape', () => t => render([ interpolator(t) ]))
```

### Example: features

```
let features  // Given an array of GeoJSON Polygon or MultiPolygon features

const scale = **radiusScale**( path.area(mergedFeatures), 7.5e9 )
const circles = features.map(feature => {
  return **geoToCircle**(feature, path, scale(feature.properties['population']))
})

const separatedCircles = **avoidOverlap**(circles)
const circlePaths = separatedCircles.map(**circlePath**)
const interpolator = **interpolatePaths**(features.map(path), circlePaths)

d3.transition().tween('shapes', () => t => render(interpolator[i](t)))
```
