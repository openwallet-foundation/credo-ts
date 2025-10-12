import varint from 'varint'

import type { AnyUint8Array } from '../types'
import { Buffer } from './buffer'

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class VarintEncoder {
  public static decode(data: AnyUint8Array | number[] | Buffer) {
    const code = varint.decode(data)
    return [code, varint.decode.bytes] as const
  }

  public static encode(int: number) {
    const target = new Buffer(VarintEncoder.encodingLength(int))
    varint.encode(int, target)
    return target
  }

  public static encodingLength(int: number) {
    return varint.encodingLength(int)
  }
}
