import cbor from 'cbor'
import { sha256 } from 'js-sha256'
import { BufferEncoder } from './BufferEncoder'
import { Buffer } from './buffer'
import { MultibaseEncoder, BaseName } from './MultibaseEncoder'
import { MultihashEncoder } from './MultihashEncoder'
import multibase from 'multibase'

type Metadata = {
  urls?: string[]
  contentType?: string
}

export type HashlinkData = {
  checksum: string
  metadata?: Metadata
}

const URLS = 0x0f
const CONTENTTYPE = 0x0e

export class Hashlink {
  /**
   *
   * Encodes a buffer, with optional metadata, into a hashlink
   *
   * @param {Buffer} buffer the buffer to encode into a hashlink
   * @param {string} hashName the name of the hashing algorithm 'sha2-256'
   * @param {BaseName} baseName the name of the base encoding algorithm 'base58btc'
   * @param {Metadata} metadata the optional metadata in the hashlink
   */
  public static encode(buffer: Buffer, hashName: 'sha2-256', baseName: BaseName = 'base58btc', metadata?: Metadata) {
    const checksum = this.encodeMultihashEncoder(buffer, hashName, baseName)
    const mbMetadata = metadata ? this.encodeMetadata(metadata, baseName) : null
    return mbMetadata ? `hl:${checksum}:${mbMetadata}` : `hl:${checksum}`
  }

  /**
   *
   * Decodes a hashlink into HashlinkData object
   *
   * @param {string} hashlink the hashlink that needs decoding
   */
  public static decode(hashlink: string): HashlinkData {
    const hashlinkList = hashlink.split(':')
    if (this.validate(hashlink)) {
      const checksum = hashlinkList[1]
      const metadata = hashlinkList[2] ? this.decodeMetadata(hashlinkList[2]) : null

      return metadata ? { checksum, metadata } : { checksum }
    } else {
      throw new Error(`Hashlink, ${hashlink}, is invalid`)
    }
  }

  public static validate(hashlink: string): boolean {
    const hashlinkList = hashlink.split(':')
    const validMultibase = MultibaseEncoder.validate(hashlinkList[1])
    const { data } = MultibaseEncoder.decode(hashlinkList[1])
    const validMultihash = MultihashEncoder.validate(data)
    return validMultibase && validMultihash ? true : false
  }

  private static encodeMultihashEncoder(buffer: Buffer, hashName: 'sha2-256', baseName: BaseName): string {
    // TODO: Support more hashing algorithms
    const hash = new Uint8Array(sha256.array(buffer))
    const mh = MultihashEncoder.encode(hash, hashName)
    const mb = MultibaseEncoder.encode(mh, baseName)
    return BufferEncoder.toUtf8String(mb)
  }

  private static encodeMetadata(metadata: Metadata, baseName: BaseName): string {
    const metadataMap = new Map()

    for (const key of Object.keys(metadata)) {
      switch (key) {
        case 'urls':
          metadataMap.set(URLS, metadata.urls)
          break
        case 'contentType':
          metadataMap.set(CONTENTTYPE, metadata.contentType)
          break
        default:
          throw new Error(`Metadata, ${metadata}, is invalid`)
      }
    }

    const cborData = cbor.encode(metadataMap)

    const multibaseMetadata = MultibaseEncoder.encode(cborData, baseName)

    return BufferEncoder.toUtf8String(multibaseMetadata)
  }

  private static decodeMetadata(mb: string): Metadata {
    const obj = { urls: [], contentType: '' }
    const { data } = MultibaseEncoder.decode(mb)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cborData: Map<number, unknown> = cbor.decode(data)
      cborData.forEach((value, key) => {
        switch (key) {
          case URLS:
            obj.urls = value
            break
          case CONTENTTYPE:
            obj.contentType = value
            break
          default:
            throw new Error(`Metadata, ${key}:${value}, is invalid`)
        }
      })
      return obj
    } catch (error) {
      throw new Error(`Metadata, ${mb}, is invalid: ${error}`)
    }
  }
}
