export function rightSplit(string: string, sep: string, limit: number) {
  const split = string.split(sep)
  return limit ? [split.slice(0, -limit).join(sep)].concat(split.slice(-limit)) : split
}

export function randomString(len: number) {
  const charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let randomString = ''
  for (let i = 0; i < len; i++) {
    const randomPoz = Math.floor(Math.random() * charSet.length)
    randomString += charSet.substring(randomPoz, randomPoz + 1)
  }
  return randomString
}
