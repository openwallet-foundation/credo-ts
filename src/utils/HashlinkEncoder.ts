import type { Attachment } from '../decorators/attachment/Attachment'
import type { BaseName } from './MultiBaseEncoder'
import type { Buffer } from './buffer'

import cbor from 'borc'
import { sha256 } from 'js-sha256'

import { AriesFrameworkError } from '../error/AriesFrameworkError'

import { BufferEncoder } from './BufferEncoder'
import { JsonEncoder } from './JsonEncoder'
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

export class HashlinkEncoder {
  /**
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
    metadata?: Metadata,
    hashAlgorithm: 'sha2-256' = 'sha2-256',
    baseEncoding: BaseName = 'base58btc'
  ) {
    const checksum = this.encodeMultiHashEncoder(buffer, hashAlgorithm, baseEncoding)
    const mbMetadata = metadata && Object.keys(metadata).length > 0 ? this.encodeMetadata(metadata, baseEncoding) : null
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
    if (this.isValid(hashlink)) {
      const hashlinkList = hashlink.split(':')
      const [, checksum, encodedMetadata] = hashlinkList
      return encodedMetadata ? { checksum, metadata: this.decodeMetadata(encodedMetadata) } : { checksum }
    } else {
      throw new Error(`Invalid hashlink: ${hashlink}`)
    }
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
    return validMultiBase && validMultiHash ? true : false
  }

  public static encodeAttachment(
    attachment: Attachment,
    hashAlgorithm: 'sha2-256' = 'sha2-256',
    baseName: BaseName = 'base58btc'
  ) {
    if (attachment.data.sha256) {
      return `hl:${attachment.data.sha256}`
    } else if (attachment.data.base64) {
      return this.encode(BufferEncoder.fromBase64(attachment.data.base64), {}, hashAlgorithm, baseName)
    } else if (attachment.data.json) {
      return this.encode(JsonEncoder.toBuffer(attachment.data.json), {}, hashAlgorithm, baseName)
    } else {
      throw new AriesFrameworkError(`Attachment: (${attachment.id}) has no data to create a link with`)
    }
  }

  private static encodeMultiHashEncoder(
    buffer: Buffer | Uint8Array,
    hashName: 'sha2-256' = 'sha2-256',
    baseEncoding: BaseName = 'base58btc'
  ): string {
    // TODO: Support more hashing algorithms
    const hash = new Uint8Array(sha256.array(buffer))
    const mh = MultiHashEncoder.encode(hash, hashName)
    const mb = MultiBaseEncoder.encode(mh, baseEncoding)
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

    const multibaseMetadata = MultiBaseEncoder.encode(cborData, baseEncoding)

    return BufferEncoder.toUtf8String(multibaseMetadata)
  }

  private static decodeMetadata(mb: string): Metadata {
    const obj = { urls: [] as string[], contentType: '' }
    const { data } = MultiBaseEncoder.decode(mb)
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
