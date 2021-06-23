import type { BaseName } from './MultibaseEncoder'
import type { Buffer } from './buffer'

import cbor from 'borc'
import { sha256 } from 'js-sha256'

import { BufferEncoder } from './BufferEncoder'
import { MultibaseEncoder } from './MultibaseEncoder'
import { MultihashEncoder } from './MultihashEncoder'

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

export class HashlinkEncoder {
  /**
   *
   * Encodes a buffer, with optional metadata, into a hashlink
   *
   * @param buffer the buffer to encode into a hashlink
   * @param hashAlgorithm the name of the hashing algorithm 'sha2-256'
   * @param baseEncoding the name of the base encoding algorithm 'base58btc'
   * @param metadata the optional metadata in the hashlink
   *
   * @returns hashlink hashlink with optional metadata
   */
  public static encode(
    buffer: Buffer | Uint8Array,
    hashAlgorithm: 'sha2-256',
    baseEncoding: BaseName = 'base58btc',
    metadata?: Metadata
  ) {
    const checksum = this.encodeMultihashEncoder(buffer, hashAlgorithm, baseEncoding)
    const mbMetadata = metadata ? this.encodeMetadata(metadata, baseEncoding) : null
    return mbMetadata ? `hl:${checksum}:${mbMetadata}` : `hl:${checksum}`
  }

  /**
   *
   * Decodes a hashlink into HashlinkData object
   *
   * @param hashlink the hashlink that needs decoding
   *
   * @returns object the decoded hashlink
   */
  public static decode(hashlink: string): HashlinkData {
    if (this.isValid(hashlink)) {
      const hashlinkList = hashlink.split(':')
      //      const checksum = hashlinkList[1]
      //      const metadata = hashlinkList[2] ? this.decodeMetadata(hashlinkList[2]) : null

      const [, checksum, encodedMetadata] = hashlinkList
      return encodedMetadata ? { checksum, metadata: this.decodeMetadata(encodedMetadata) } : { checksum }
    } else {
      throw new Error(`Invalid hashlink: ${hashlink}`)
    }
  }

  /**
   *
   * Validates a hashlink
   *
   * @param hashlink the hashlink that needs validating
   *
   * @returns a boolean whether the hashlink is valid
   *
   * */

  public static isValid(hashlink: string): boolean {
    const hashlinkList = hashlink.split(':')
    const validMultibase = MultibaseEncoder.isValid(hashlinkList[1])
    if (!validMultibase) {
      return false
    }
    const { data } = MultibaseEncoder.decode(hashlinkList[1])
    const validMultihash = MultihashEncoder.isValid(data)
    return validMultibase && validMultihash ? true : false
  }

  private static encodeMultihashEncoder(
    buffer: Buffer | Uint8Array,
    hashName: 'sha2-256',
    baseEncoding: BaseName
  ): string {
    // TODO: Support more hashing algorithms
    const hash = new Uint8Array(sha256.array(buffer))
    const mh = MultihashEncoder.encode(hash, hashName)
    const mb = MultibaseEncoder.encode(mh, baseEncoding)
    return BufferEncoder.toUtf8String(mb)
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

    const multibaseMetadata = MultibaseEncoder.encode(cborData, baseEncoding)

    return BufferEncoder.toUtf8String(multibaseMetadata)
  }

  private static decodeMetadata(mb: string): Metadata {
    const obj = { urls: [] as string[], contentType: '' }
    const { data } = MultibaseEncoder.decode(mb)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
