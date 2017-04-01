import { scaleSqrt } from 'd3-scale'

export default (totalArea, totalValue) =>
  scaleSqrt()
    .domain([0, totalValue])
    .range([0, Math.sqrt(totalArea / Math.PI)])
