export default ({ x, y, r, clockwise=false }) =>
  `M${x},${y - r}A${r},${r},0,0,${Math.round(clockwise)},${x},${y + r}A${r},${r},0,0,${Math.round(clockwise)},${x},${y - r}`
