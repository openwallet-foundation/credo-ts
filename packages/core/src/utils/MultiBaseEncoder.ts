import { decodeFromBase58, encodeToBase58 } from './base58'

export type BaseName = 'base58btc'

type EncodingMap = {
  [key in BaseName]: (data: Uint8Array) => string
}

type DecodingMap = {
  [key: string]: (data: string) => { data: Uint8Array; baseName: BaseName }
}

const multibaseEncodingMap: EncodingMap = {
  base58btc: (data) => `z${encodeToBase58(data)}`,
}

const multibaseDecodingMap: DecodingMap = {
  z: (data) => ({ data: decodeFromBase58(data.substring(1)), baseName: 'base58btc' }),
}

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class MultiBaseEncoder {
  /**
   *
   * Encodes a buffer into a multibase
   *
   * @param buffer the buffer that has to be encoded
   * @param baseName the encoding algorithm
   */
  public static encode(buffer: Uint8Array, baseName: BaseName) {
    const encode = multibaseEncodingMap[baseName]

    if (!encode) {
      throw new Error(`Unsupported encoding '${baseName}'`)
    }

    return encode(buffer)
  }

  /**
   *
   * Decodes a multibase into a Uint8Array
   *
   * @param data the multibase that has to be decoded
   *
   * @returns decoded data and the multi base name
   */
  public static decode(data: string): { data: Uint8Array; baseName: string } {
    const prefix = data[0]
    const decode = multibaseDecodingMap[prefix]

    if (!decode) {
      throw new Error(`No decoder found for multibase prefix '${prefix}'`)
    }

    return decode(data)
  }

  public static isValid(data: string): boolean {
    try {
      MultiBaseEncoder.decode(data)
      return true
    } catch (_error) {
      return false
    }
  }
}
