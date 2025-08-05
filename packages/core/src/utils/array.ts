import type { SingleOrArray } from '../types'

export const asArray = <T>(val?: SingleOrArray<T>): Array<T> => {
  if (!val) return []
  if (Array.isArray(val)) return val
  return [val]
}

type ExtractValueFromSingleOrArray<V> = V extends SingleOrArray<infer Value> ? Value : never

export const mapSingleOrArray = <Wrapper extends SingleOrArray<unknown>, Return>(
  value: Wrapper,
  fn: (value: ExtractValueFromSingleOrArray<Wrapper>) => Return
): SingleOrArray<Return> => {
  const mapped = asArray<ExtractValueFromSingleOrArray<Wrapper>>(value as []).map(fn)

  // We need to return a single or array value based on the input type
  return Array.isArray(value) ? mapped : mapped[0]
}
