export function rightSplit(string: string, sep: string, limit: number) {
  const split = string.split(sep)
  return limit ? [split.slice(0, -limit).join(sep)].concat(split.slice(-limit)) : split
}
