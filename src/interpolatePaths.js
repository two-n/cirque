import interpolatePath from './interpolatePath'

export default (a, b) => {
  const interpolators = b.map( (b_i, i) => interpolatePath(a[i], b_i) )
  return t => b.map( (b_i, i) => interpolators[i](t) )
}
