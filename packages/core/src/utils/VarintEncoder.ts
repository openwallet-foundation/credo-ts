import { CredoError } from '../error'

/**
 * Unsigned varints store an integer in little-endian seven-bit groups, with each byte's
 * high bit indicating whether another group follows. Arithmetic accumulation avoids
 * 32-bit truncation.
 * Decoding rejects non-minimal encodings and values outside the safe-integer range.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: no explanation
export class VarintEncoder {
  public static decode(data: Uint8Array | number[]) {
    if (data.length === 0) {
      throw new CredoError('Cannot decode an empty varint')
    }

    // Accumulate little-endian seven-bit groups using arithmetic to preserve safe-integer precision.
    let value = 0
    let multiplier = 1

    for (let index = 0; index < data.length; index++) {
      if (index >= 9) {
        throw new CredoError('Varint encoding is longer than nine bytes')
      }

      const byte = data[index]
      if (!Number.isInteger(byte) || byte < 0 || byte > 0xff) {
        throw new CredoError('Varint input contains an invalid byte')
      }

      // Mask off the continuation bit and add this group's value at its base-128 position.
      value += (byte & 0x7f) * multiplier
      if (!Number.isSafeInteger(value)) {
        throw new CredoError('Varint value exceeds the maximum safe integer')
      }

      if ((byte & 0x80) === 0) {
        // A zero final group adds no value and makes a multi-byte encoding non-minimal.
        if (index > 0 && (byte & 0x7f) === 0) {
          throw new CredoError('Varint encoding is not minimal')
        }

        return [value, index + 1] as const
      }

      // A set continuation bit means the next group contributes at the next base-128 position.
      multiplier *= 0x80
    }

    throw new CredoError('Varint encoding is truncated')
  }

  public static encode(int: number) {
    const target = new Uint8Array(VarintEncoder.encodingLength(int))
    let value = int

    // Extract seven-bit groups without truncating the remaining value to 32 bits.
    for (let index = 0; index < target.length; index++) {
      const remainder = value % 0x80
      value = Math.floor(value / 0x80)
      target[index] = remainder | (value > 0 ? 0x80 : 0)
    }

    return target
  }

  public static encodingLength(int: number) {
    if (!Number.isSafeInteger(int) || int < 0) {
      throw new CredoError('Varint value must be a non-negative safe integer')
    }

    // Count the seven-bit groups needed, including one byte for zero.
    let length = 1
    while (int >= 0x80) {
      int = Math.floor(int / 0x80)
      length++
    }

    return length
  }
}
