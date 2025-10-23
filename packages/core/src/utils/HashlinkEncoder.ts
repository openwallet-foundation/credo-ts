// @ts-expect-error ts is giving me headaches because this package has no types
import cbor from 'borc'
import type { HashName } from '../crypto'
import type { Buffer } from './buffer'
import type { BaseName } from './MultiBaseEncoder'

import { MultiBaseEncoder } from './MultiBaseEncoder'
import { MultiHashEncoder } from './MultiHashEncoder'

type Metadata = {
  urls?: string[]
  contentType?: string
}

export type HashlinkData = {
  checksum: string
  metadata?: Metadata
}

const hexTable = {
  urls: 0x0f,
  contentType: 0x0e,
}

// biome-ignore lint/complexity/noStaticOnlyClass: no explanation
export class HashlinkEncoder {
  /**
   * Encodes a buffer, with optional metadata, into a hashlink
   *
   * @param buffer the buffer to encode into a hashlink
   * @param hashAlgorithm the name of the hashing algorithm 'sha-256'
   * @param baseEncoding the name of the base encoding algorithm 'base58btc'
   * @param metadata the optional metadata in the hashlink
   *
   * @returns hashlink hashlink with optional metadata
   */
  public static encode(
    buffer: Buffer | Uint8Array,
    hashAlgorithm: HashName,
    baseEncoding: BaseName = 'base58btc',
    metadata?: Metadata
  ) {
    const checksum = HashlinkEncoder.encodeMultiHash(buffer, hashAlgorithm, baseEncoding)
    const mbMetadata =
      metadata && Object.keys(metadata).length > 0 ? HashlinkEncoder.encodeMetadata(metadata, baseEncoding) : null
    return mbMetadata ? `hl:${checksum}:${mbMetadata}` : `hl:${checksum}`
  }

  /**
   * Decodes a hashlink into HashlinkData object
   *
   * @param hashlink the hashlink that needs decoding
   *
   * @returns object the decoded hashlink
   */
  public static decode(hashlink: string): HashlinkData {
    if (HashlinkEncoder.isValid(hashlink)) {
      const hashlinkList = hashlink.split(':')
      const [, checksum, encodedMetadata] = hashlinkList
      return encodedMetadata ? { checksum, metadata: HashlinkEncoder.decodeMetadata(encodedMetadata) } : { checksum }
    }
    throw new Error(`Invalid hashlink: ${hashlink}`)
  }

  /**
   * Validates a hashlink
   *
   * @param hashlink the hashlink that needs validating
   *
   * @returns a boolean whether the hashlink is valid
   *
   * */
  public static isValid(hashlink: string): boolean {
    const hashlinkList = hashlink.split(':')
    const validMultiBase = MultiBaseEncoder.isValid(hashlinkList[1])
    if (!validMultiBase) {
      return false
    }
    const { data } = MultiBaseEncoder.decode(hashlinkList[1])
    const validMultiHash = MultiHashEncoder.isValid(data)
    return !!validMultiHash
  }

  private static encodeMultiHash(
    data: Buffer | Uint8Array,
    hashName: HashName,
    baseEncoding: BaseName = 'base58btc'
  ): string {
    const mh = MultiHashEncoder.encode(data, hashName)
    const mb = MultiBaseEncoder.encode(mh, baseEncoding)
    return mb
  }

  private static encodeMetadata(metadata: Metadata, baseEncoding: BaseName): string {
    const metadataMap = new Map<number, unknown>()

    for (const key of Object.keys(metadata)) {
      if (key === 'urls' || key === 'contentType') {
        metadataMap.set(hexTable[key], metadata[key])
      } else {
        throw new Error(`Invalid metadata: ${metadata}`)
      }
    }

    const cborData = cbor.encode(metadataMap)

    const multibaseMetadata = MultiBaseEncoder.encode(cborData, baseEncoding)

    return multibaseMetadata
  }

  private static decodeMetadata(mb: string): Metadata {
    const obj = { urls: [] as string[], contentType: '' }
    const { data } = MultiBaseEncoder.decode(mb)
    try {
      // biome-ignore lint/suspicious/noExplicitAny: no explanation
      const cborData: Map<number, any> = cbor.decode(data)
      cborData.forEach((value, key) => {
        if (key === hexTable.urls) {
          obj.urls = value
        } else if (key === hexTable.contentType) {
          obj.contentType = value
        } else {
          throw new Error(`Invalid metadata property: ${key}:${value}`)
        }
      })
      return obj
    } catch (error) {
      throw new Error(`Invalid metadata: ${mb}, ${error}`)
    }
  }
}
