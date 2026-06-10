export function bytesToBigint(b: Uint8Array): bigint {
  if (b.length === 0) {
    throw new Error('Empty byte array is not supported')
  }

  let value = 0n
  for (let i = 0; i < b.length; i++) {
    value = (value << 8n) | BigInt(b[i])
  }

  return value
}
