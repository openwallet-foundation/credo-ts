import type { Uint8ArrayBuffer } from '../types'

// Question: Spec isn't clear about the endianness. Assumes big-endian here
// since ACA-Py uses big-endian.
export default function timestamp(): Uint8ArrayBuffer {
  let time = Date.now()
  const bytes = []
  for (let i = 0; i < 8; i++) {
    const byte = time & 0xff
    bytes.push(byte)
    time = (time - byte) / 256 // Javascript right shift (>>>) only works on 32 bit integers
  }
  return Uint8Array.from(bytes).reverse()
}

/**
 * Returns the current time in seconds
 */
export function nowInSeconds() {
  return Math.floor(Date.now() / 1000)
}

export function addSecondsToDate(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000)
}

export function dateToSeconds(date: Date) {
  return Math.floor(date.getTime() / 1000)
}

export function dateToSeconds(date: Date) {
  return Math.floor(date.getTime() / 1000)
}
