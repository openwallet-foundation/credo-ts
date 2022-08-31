export function objectEquals(x: Map<string, unknown>, y: Map<string, unknown>): boolean {
  if (x === null || x === undefined || y === null || y === undefined) {
    return x === y
  }

  // after this just checking type of one would be enough
  if (x.constructor !== y.constructor) {
    return false
  }
  // if they are functions, they should exactly refer to same one (because of closures)
  if (x instanceof Function) {
    return x === y
  }
  // if they are regexps, they should exactly refer to same one (it is hard to better equality check on current ES)
  if (x instanceof RegExp) {
    return x === y
  }
  if (x === y || x.valueOf() === y.valueOf()) {
    return true
  }

  // if they are dates, they must had equal valueOf
  if (x instanceof Date) {
    return false
  }

  // if they are strictly equal, they both need to be object at least
  if (!(x instanceof Object)) {
    return false
  }
  if (!(y instanceof Object)) {
    return false
  }

  const xkeys = Array.from(x.keys())
  const ykeys = Array.from(y.keys())
  if (!equalsIgnoreOrder(xkeys, ykeys)) {
    return false
  }
  return (
    xkeys.every(function (i) {
      return xkeys.indexOf(i) !== -1
    }) &&
    xkeys.every(function (xkey) {
      // get the x map entries for this key

      const xval: any = x.get(xkey)
      const yval: any = y.get(xkey)

      const a: Map<string, unknown> = new Map([[xkey, xval]])
      if (a.size === 1) {
        return xval === yval
      }
      // get the y map entries for this key
      const b: Map<string, unknown> = new Map([[xkey, yval]])
      return objectEquals(a, b)
    })
  )
}

function equalsIgnoreOrder(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const uniqueValues = new Set([...a, ...b])
  for (const v of uniqueValues) {
    const aCount = a.filter((e) => e === v).length
    const bCount = b.filter((e) => e === v).length
    if (aCount !== bCount) return false
  }
  return true
}
