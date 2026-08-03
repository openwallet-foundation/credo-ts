import varint from 'varint'

// biome-ignore lint/complexity/noStaticOnlyClass: no explanation
export class VarintEncoder {
  public static decode(data: Uint8Array | number[]) {
    const code = varint.decode(data)
    return [code, varint.decode.bytes] as const
  }

  public static encode(int: number) {
    const target = new Uint8Array(VarintEncoder.encodingLength(int))
    varint.encode(int, target)
    return target
  }

  public static encodingLength(int: number) {
    return varint.encodingLength(int)
  }
}
