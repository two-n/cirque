import { forceSimulation, forceCollide, forceX, forceY } from 'd3-force'

// Returns same array with circles' x and y mutated to avoid collisions
export default circles => {
  circles.forEach(d => { d.x0 = d.x; d.y0 = d.y })
  const force = forceSimulation(circles).stop()
    .force('x', forceX(d => d.x0))
    .force('y', forceY(d => d.y0))
    .force('collide', forceCollide(d => d.r))
  for (let i = 0; i < 100; ++i) force.tick()
  circles.forEach(d => { delete d.x0; delete d.y0 })
  return circles
}
