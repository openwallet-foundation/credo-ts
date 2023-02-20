import type { JwsGeneralFormat } from '../../crypto/JwsTypes'

import { Expose, Type } from 'class-transformer'
import { IsDate, IsHash, IsInstance, IsInt, IsMimeType, IsOptional, IsString, ValidateNested } from 'class-validator'

import { Jws } from '../../crypto/JwsTypes'
import { AriesFrameworkError } from '../../error'
import { JsonEncoder } from '../../utils/JsonEncoder'
import { uuid } from '../../utils/uuid'

export interface AttachmentOptions {
  id?: string
  description?: string
  filename?: string
  mimeType?: string
  lastmodTime?: Date
  byteCount?: number
  data: AttachmentDataOptions
}

export interface AttachmentDataOptions {
  base64?: string
  json?: Record<string, unknown>
  links?: string[]
  jws?: Jws
  sha256?: string
}

/**
 * A JSON object that gives access to the actual content of the attachment
 */
export class AttachmentData {
  /**
   * Base64-encoded data, when representing arbitrary content inline instead of via links. Optional.
   */
  @IsOptional()
  @IsString()
  public base64?: string

  /**
   *  Directly embedded JSON data, when representing content inline instead of via links, and when the content is natively conveyable as JSON. Optional.
   */
  @IsOptional()
  public json?: Record<string, unknown>

  /**
   * A list of zero or more locations at which the content may be fetched. Optional.
   */
  @IsOptional()
  @IsString({ each: true })
  public links?: string[]

  /**
   * A JSON Web Signature over the content of the attachment. Optional.
   */
  @IsOptional()
  public jws?: Jws

  /**
   * The hash of the content. Optional.
   */
  @IsOptional()
  @IsHash('sha256')
  public sha256?: string

  public constructor(options: AttachmentDataOptions) {
    if (options) {
      this.base64 = options.base64
      this.json = options.json
      this.links = options.links
      this.jws = options.jws
      this.sha256 = options.sha256
    }
  }
}

/**
 * Represents DIDComm attachment
 * https://github.com/hyperledger/aries-rfcs/blob/master/concepts/0017-attachments/README.md
 */
export class Attachment {
  public constructor(options: AttachmentOptions) {
    if (options) {
      this.id = options.id ?? uuid()
      this.description = options.description
      this.filename = options.filename
      this.mimeType = options.mimeType
      this.lastmodTime = options.lastmodTime
      this.byteCount = options.byteCount
      this.data = new AttachmentData(options.data)
    }
  }

  @Expose({ name: '@id' })
  public id!: string

  /**
   * An optional human-readable description of the content.
   */
  @IsOptional()
  @IsString()
  public description?: string

  /**
   * A hint about the name that might be used if this attachment is persisted as a file. It is not required, and need not be unique. If this field is present and mime-type is not, the extension on the filename may be used to infer a MIME type.
   */
  @IsOptional()
  @IsString()
  public filename?: string

  /**
   * Describes the MIME type of the attached content. Optional but recommended.
   */
  @Expose({ name: 'mime-type' })
  @IsOptional()
  @IsMimeType()
  public mimeType?: string

  /**
   * A hint about when the content in this attachment was last modified.
   */
  @Expose({ name: 'lastmod_time' })
  @Type(() => Date)
  @IsOptional()
  @IsDate()
  public lastmodTime?: Date

  /**
   * Optional, and mostly relevant when content is included by reference instead of by value. Lets the receiver guess how expensive it will be, in time, bandwidth, and storage, to fully fetch the attachment.
   */
  @Expose({ name: 'byte_count' })
  @IsOptional()
  @IsInt()
  public byteCount?: number

  @Type(() => AttachmentData)
  @ValidateNested()
  @IsInstance(AttachmentData)
  public data!: AttachmentData

  /*
   * Helper function returning JSON representation of attachment data (if present). Tries to obtain the data from .base64 or .json, throws an error otherwise
   */
  public getDataAsJson<T>(): T {
    if (typeof this.data.base64 === 'string') {
      return JsonEncoder.fromBase64(this.data.base64) as T
    } else if (this.data.json) {
      return this.data.json as T
    } else {
      throw new AriesFrameworkError('No attachment data found in `json` or `base64` data fields.')
    }
  }

  public addJws(jws: JwsGeneralFormat) {
    // If no JWS yet, assign to current JWS
    if (!this.data.jws) {
      this.data.jws = jws
    }
    // Is already jws array, add to it
    else if ('signatures' in this.data.jws) {
      this.data.jws.signatures.push(jws)
    }
    // If already single JWS, transform to general jws format
    else {
      this.data.jws = {
        signatures: [this.data.jws, jws],
      }
    }
  }
}
