import { Expose, Type } from 'class-transformer'
import { IsBase64, IsInstance, IsMimeType, IsOptional, IsString, ValidateNested } from 'class-validator'

import { Jws } from '../../../crypto/JwsTypes'
import { AriesFrameworkError } from '../../../error'
import { JsonEncoder } from '../../../utils/JsonEncoder'
import { uuid } from '../../../utils/uuid'

export const ATTACHMENT_MEDIA_TYPE = 'application/json'

export interface AttachmentOptions {
  id?: string
  description?: string
  filename?: string
  mediaType?: string
  byteCount?: number
  data: AttachmentData
}

export interface AttachmentDataOptions {
  base64?: string
  json?: Record<string, unknown>
  links?: string[]
  jws?: Jws
}

/**
 * A JSON object that gives access to the actual content of the attachment
 */
export class AttachmentData {
  /**
   * Base64-encoded data, when representing arbitrary content inline instead of via links. Optional.
   */
  @IsOptional()
  @IsBase64()
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

  public constructor(options: AttachmentDataOptions) {
    if (options) {
      this.base64 = options.base64
      this.json = options.json
      this.links = options.links
      this.jws = options.jws
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
      this.mediaType = options.mediaType
      this.data = options.data
    }
  }

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
   * A hint about the attachment format
   */
  @IsOptional()
  @IsString()
  public format?: string

  /**
   * Describes the MIME type of the attached content. Optional but recommended.
   */
  @Expose({ name: 'media_type' })
  @IsOptional()
  @IsMimeType()
  public mediaType?: string

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
}

export function createJSONAttachment(id: string, message: Record<string, unknown>): Attachment {
  return new Attachment({
    id: id,
    mediaType: ATTACHMENT_MEDIA_TYPE,
    data: {
      json: message,
    },
  })
}

export function createBase64Attachment(id: string, message: Record<string, unknown>): Attachment {
  return new Attachment({
    id: id,
    mediaType: ATTACHMENT_MEDIA_TYPE,
    data: {
      base64: JsonEncoder.toBase64(message),
    },
  })
}
