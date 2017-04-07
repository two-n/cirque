import { range, pairs, sum, mean, scan, descending, merge } from 'd3-array'
import { interpolate } from 'd3-interpolate'
import Bezier from 'bezier-js'


const MISALIGNMENT_TOLERANCE = 0.15
const MIN_CIRCLE_SAMPLE_DISTANCE = 1


// Vector arithmetic, cycling a if shorter than b
const add = (a, b) => b.map((b_i, i) => b_i + a[i % a.length])
const subtract = (a, b) => b.map((b_i, i) => b_i - a[i % a.length])  // a from b

const distance = (pt1, pt2=pt1) =>
  Math.sqrt(Math.pow(pt1[0] - pt2[0], 2) + Math.pow(pt1[1] - pt2[1], 2))
const circumference = ({ r }) => 2 * Math.PI * r
const midpoint = (pt1, pt2) => [(pt1[0] + pt2[0]) / 2, (pt1[1] + pt2[1]) / 2]
const computeIntervals = points => pairs(points).map(pair => distance(...pair))


const angleTowards = (pt1, pt2) =>
  Math.atan2(pt2[1] - pt1[1], pt2[0] - pt1[0]) + Math.PI/2

const project = (c, angle) =>
  [c.x + c.r * Math.sin(angle), c.y + c.r * -Math.cos(angle)]

const sampleCircle = (c, numSamples, offset = 0) =>
  range(0, numSamples).map(i =>
    project(c, (c.clockwise ? 1 : -1) * i/numSamples * 2*Math.PI + offset)
  )


const N = '[-\\d\\.e]+',  // number
      MN = `(${N})`,  // matched number
      S = '(?:\s+|,)',  // separator
      OS = `${S}?`,  // optional separator
      MOVE = [`M\\s*`,MN,S,MN].join(''),
      ARC = [`A\\s*`,MN,S,N,S,N,S,N,S,MN,S,N,S,N].join(''),
      CIRCLE = [`^\\s*`,MOVE,OS,ARC,OS,ARC,OS,'$'].join(''),
      circlePathPattern = new RegExp(CIRCLE, 'i'),
      isCircle = RegExp.prototype.test.bind(circlePathPattern)

const processCircle = d => {
  const [x, top, r, sweep] = d.match(circlePathPattern).slice(1).map(Number),
        circle = { x, y: top + r, r, clockwise: !!+sweep }
  return {
    circle,
    numPoints: Math.ceil(circumference(circle) / MIN_CIRCLE_SAMPLE_DISTANCE),
  }
}


// Return an array of path commands in the form { type, coords }
// - Use only M,L,Q,C,A — convert the rest (including relative commands) to equivalents
const pathToCommands = d => {
  const commandIndices = []
  for (let i = 0; i < d.length; i++) {
    if (/[MLHVCSQTAZ]/i.test(d[i])) commandIndices.push(i)
  }

  let prevPoint = [0, 0], movePoint
  return commandIndices.map((index, i) => {
    const type = d[index],
          absolute = /[A-Z]/.test(type),
          slice = d.slice(index + 1, commandIndices[i + 1]),
          coords = slice.split(/\s+|,/).filter(Boolean).map(Number)

    if (/Z/i.test(type)) return { type: 'L', coords: prevPoint = movePoint }

    if (/[HV]/i.test(type)) {
      const vertical = /V/i.test(type)
      return {
        type: 'L',
        coords: prevPoint = [
          !vertical ? coords[0] + (absolute ? 0 : prevPoint[0]) : prevPoint[0],
           vertical ? coords[0] + (absolute ? 0 : prevPoint[1]) : prevPoint[1],
        ],
      }
    }

    if (/[TS]/i.test(type)) {
      const { type: prevType, coords: prevCoords } = commands[i - 1]
      const controlPoint = /T,Q|S,C/i.test([ type, prevType ])
        ? add(prevPoint, subtract(prevCoords.slice(-4, -2), prevPoint))
        : prevPoint

      const newCoords = absolute ? coords : add(prevPoint, coords)
      prevPoint = newCoords.slice(-2)
      return {
        type: /T/.test(type) ? 'Q' : 'C',
        coords: [...controlPoint, newCoords],
      }
    }

    if (/A/i.test(type)) {
      const point = coords.slice(-2)
      return {
        type: 'A',
        coords: [
          ...coords.slice(0, -2),
          ...(prevPoint = (absolute ? point : add(prevPoint, point))),
        ],
      }
    }

    const newCoords = absolute ? coords : add(prevPoint, coords)
    prevPoint = newCoords.slice(-2)
    if (/M/i.test(type)) { movePoint = prevPoint }
    return { type: type.toUpperCase(), coords: newCoords }
  })
}


// Return processed path segments (each beginning with a move command)
const processPath = d => {
  const commands = pathToCommands(d)

  const shapes = []
  let currShape
  commands.forEach(command => {
    if (command.type === 'M') shapes.push(currShape = [])
    currShape.push(command)
  })

  return shapes.map(commands => {
    const points = commands.map(({ coords, point }) => coords.slice(-2))
    const centroid = [mean(points.map(d => d[0])), mean(points.map(d => d[1]))]

    return {
      commands,
      numPoints: commands.length,
      length: sum([0, ...computeIntervals(points)]),
      offset: angleTowards(centroid, midpoint(points[0], points[points.length - 1]))
    }
  }).sort((a, b) => descending(a.length, b.length))
}


const shapeIterator = (d, numPoints) => {
  if (d.circle != null) {
    const points = sampleCircle(d.circle, numPoints - 1, d.offset)
    points.push(points[0])
    return {
      commands: points.map(coords => ({ coords })),  // Type not yet known
      length: distance(points[0], points[1]) * (numPoints - 1),
      progress: 0,
    }
  }
  return { commands: [...d.commands], length: d.length, progress: 0 }
}


// Returns a copy of the original command with size zero
// const dummyCommand = (original, prevPoint) => {
//   const { type } = original
//   if (/Z/i.test(type)) return { type }

//   const coords = /[A-Z]/.test(type) ? prevPoint : [0, 0]
//   if (/M|L|T/i.test(type)) return { type, coords }
//   if (/H/i.test(type)) return { type, coords: coords.slice(0, 1) }
//   if (/V/i.test(type)) return { type, coords: coords.slice(1, 2) }
//   if (/Q|S/i.test(type)) return { type, coords: [...coords, ...coords] }
//   if (/C/i.test(type)) return { type, coords: [...coords, ...coords, ...coords] }
//   if (/A/i.test(type)) return { type, coords: [0, 0, ...original.coords.slice(2, 5), ...coords] }
// }


const splitCommand = ({ type, coords }, numPieces, prevPoint) => {
  if (/[ML]/.test(type)) {
    const piece = [0, 1].map(i => (coords[i] - prevPoint[i]) / numPieces)
    return range(1, numPieces + 1).map(i => ({
      type,
      coords: [prevPoint[0] + i * piece[0], prevPoint[1] + i * piece[1]],
    }))
  }
  if (/[CQ]/.test(type)) {
    return range(0, numPieces - 1).reduce((pieces, i) => {
      const split = pieces.pop().split( (1 / numPieces) / (1 - (i / numPieces)) )
      pieces.push(split.left, split.right)
      return pieces
    }, [ new Bezier(...prevPoint, ...coords) ])
    .map(({ points }) => (
      { type, coords: merge(points.slice(1).map(d => [d.x, d.y])) }
    ))
  }
  if (/A/.test(type)) {
    console.error('Path interpolation arc segments not yet supported')
  }
}


const resplitCommand = (d, i) => {
  if (d.prevSplitCommandPiece != d.commands[i - 1]) {
    d.completeSplitCommand = d.commands[i - 1]
    d.numSplitPieces = 1
  }
  d.numSplitPieces += 1
  const commands = splitCommand(
    d.completeSplitCommand,
    d.numSplitPieces,
    d.commands[i - d.numSplitPieces].coords.slice(-2)
  )
  d.prevSplitCommandPiece = commands[commands.length - 1]

  d.commands.splice(i - commands.length + 1, commands.length - 1, ...commands)
  d.progress -= lastInterval(commands) / d.length
}


// Generates shortest command of given type
const generateCommand = (type, coords, prevPoint) => {
  if (/[MLT]/.test(type)) return { type, coords }
  if (/Q/.test(type)) {
    const controlPoint = midpoint(prevPoint, coords)
    return { type, coords: [...controlPoint, ...coords] }
  }
  if (/C/.test(type)) {
    const controlPoint = midpoint(prevPoint, coords)
    return { type, coords: [...controlPoint, ...controlPoint, ...coords] }
  }
  if (/A/.test(type)) {
    const r = MIN_CIRCLE_SAMPLE_DISTANCE * 100
    // TODO need to copy the two flags. Interpolated flags are invalid
    console.error('Path interpolation arc segments not yet supported')
    return { type, coords: [r, r, 0, 0, 0, ...coords] }
  }
}


const lastInterval = commands =>
  distance(...commands.slice(-2).map(({ coords }) => coords.slice(-2)))

const nextProgress = (d, i) =>
  d.progress + lastInterval(d.commands.slice(Math.max(0, i - 1), i + 1)) / d.length

const inFront = (A, B, i) => {
  if (A.commands[i] == null) return A
  if (B.commands[i] == null) return B
  const nextProgressA = nextProgress(A, i)
  const nextProgressB = nextProgress(B, i)
  if (Math.abs(nextProgressA - nextProgressB) < 1e-6) return null
  return nextProgressA >= nextProgressB ? A : B
}

// Returns overloaded value:
// - which side has missing type, or
// - if neither, then whether types are alike
const typeMismatch = (A, B, i) => {
  const aType = A.commands[i] && A.commands[i].type,
        bType = B.commands[i] && B.commands[i].type
  return aType == null ? A : bType == null ? B : aType !== bType;
}


// const alignCommand = (A, B, i) => {
  // contents of loop
// }

const alignShapes = (a, b) => {
  const numPoints = Math.max(a.numPoints, b.numPoints)
  const A = shapeIterator(a, numPoints), B = shapeIterator(b, numPoints)

  // Iterate in parallel and align command sequence
  for (let i = 0; i < Math.max(A.commands.length, B.commands.length); i++) {

    const front = inFront(A, B, i), back = A === front ? B : A

    // Is the next command aligned?
    const mismatch = typeMismatch(A, B, i)
    switch (mismatch) {
      case true:
        // Is progress getting too uneven?
        if (Math.abs(nextProgress(A, i) - nextProgress(B, i)) > MISALIGNMENT_TOLERANCE) {
          // TODO have frontrunner pause by inserting zero-size command?
          // Or better yet: have ahead split the last command, if possible
        }
        break;
        
      case false:
        // TODO if last command type === behind's current command type,
        // then frontrunner could split the last command
        // else insert a zero-size command (dummy)?
        // (same as above)
        break;

      case A:  // A is missing type
      case B:  // B is missing type
        if (!front || mismatch === front || /M/.test(front.commands[i].type) || /M/.test(front.commands[i - 1].type)) {  // Is the side with missing type ahead?
          // assign it the other's command type
          const other = mismatch === A ? B : A
          if (mismatch.commands[i] != null) {
            mismatch.commands[i] = generateCommand(
              other.commands[i].type,
              mismatch.commands[i].coords.slice(-2),
              i > 0 && mismatch.commands[i - 1].coords.slice(-2)
            )
          }
          else {
            resplitCommand(mismatch, i)
          }
        }
        else {
          // // Assign wildcard an 'L' and insert a zero-size 'L' on the other side
          // const command = dummyCommand({ type: 'L' }, front.points[i - 1])
          // front.commands.splice(i, 0, command)
          // front.points.splice(i, 0, front.points[i - 1])
          // back.commands[i] = generateCommand('L', back.points[i], back.points[i - 1])

          resplitCommand(front, i)

          back.commands[i] = generateCommand(
            front.commands[i - 1].type,
            back.commands[i].coords.slice(-2),
            i > 0 && back.commands[i - 1].coords.slice(-2)
          )
        }
        break;
    }
    A.progress = nextProgress(A, i)
    B.progress = nextProgress(B, i)
  }
  return [A.commands, B.commands]
}


const commandsToPath = commands => commands.map(c => `${c.type}${c.coords || ''}`).join('')

export default (a, b) => {
  if (a === b) return () => b

  let interpolatePath
  const shapeIsCircle = [a, b].map(isCircle)
  if (shapeIsCircle[0] && shapeIsCircle[1]) {
    // If both are circle paths, skip sampling and use ordinary interpolation
    interpolatePath = interpolate(a, b)
  }
  else {
    const shapeSegments = [a, b].map((d, i) => (shapeIsCircle[i] ? processCircle : processPath)(d))
    
    const numSegments = Math.min(...shapeSegments.map((segments, i) => {
      return shapeIsCircle[i] ? Infinity : segments.length
    }))
    const alignedSegments = shapeSegments.map((d, i) => {
      return shapeIsCircle[i]
        ? [ d, ...range(1, numSegments).map(() => ({ circle: { ...d.circle, r: 0 }, numPoints: 1 })) ]
        : d.slice(0, numSegments)
    })

    const pathA = [], pathB = []
    alignedSegments[0].forEach((segmentA, i) => {
      const segmentB = alignedSegments[1][i]

      segmentA.offset == null && (segmentA.offset = segmentB.offset)
      segmentB.offset == null && (segmentB.offset = segmentA.offset)

      const alignedShapes =
        shapeIsCircle[0]
          ? alignShapes(segmentA, segmentB)
          : alignShapes(segmentB, segmentA).reverse()  // Putting circle first seems to work better
      pathA.push(commandsToPath(alignedShapes[0]))
      pathB.push(commandsToPath(alignedShapes[1]))
    })

    interpolatePath = interpolate(pathA.join(''), pathB.join(''))
  }
  return t => t === 0 ? a : t === 1 ? b : interpolatePath(t)
}
