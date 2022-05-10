import type { SingleOrArray } from './type'

export const orArrayToArray = (val?: SingleOrArray<string>): Array<string> | undefined => {
  if (!val) return undefined
  if (Array.isArray(val)) return val
  return [val]
}
