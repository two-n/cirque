export default ({ x, y, r }) => `
  M ${x} ${y - r}
  A ${r} ${r} 0 0 0 ${x} ${y + r}
  A ${r} ${r} 0 0 0 ${x} ${y - r}
`
