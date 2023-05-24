import type { SingleOrArray } from './type'

export const asArray = <T>(val?: SingleOrArray<T>): Array<T> => {
  if (!val) return []
  if (Array.isArray(val)) return val
  return [val]
}
