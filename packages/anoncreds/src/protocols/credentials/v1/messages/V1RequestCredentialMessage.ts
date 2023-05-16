import type { LegacyIndyCredentialRequest } from '../../../../formats'

import { DidCommV1Message, IsValidMessageType, parseMessageType, V1Attachment } from '@aries-framework/core'
import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

export const INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID = 'libindy-cred-request-0'

export interface V1RequestCredentialMessageOptions {
  id?: string
  comment?: string
  requestAttachments: V1Attachment[]
  attachments?: V1Attachment[]
}

export class V1RequestCredentialMessage extends DidCommV1Message {
  public readonly allowDidSovPrefix = true

  public constructor(options: V1RequestCredentialMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.comment = options.comment
      this.requestAttachments = options.requestAttachments
      this.appendedAttachments = options.attachments
    }
  }

  @IsValidMessageType(V1RequestCredentialMessage.type)
  public readonly type = V1RequestCredentialMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/1.0/request-credential')

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'requests~attach' })
  @Type(() => V1Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(V1Attachment, { each: true })
  public requestAttachments!: V1Attachment[]

  public get indyCredentialRequest(): LegacyIndyCredentialRequest | null {
    const attachment = this.requestAttachments.find(
      (attachment) => attachment.id === INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID
    )
    // Extract proof request from attachment
    const credentialReqJson = attachment?.getDataAsJson<LegacyIndyCredentialRequest>() ?? null

    return credentialReqJson
  }

  public getRequestAttachmentById(id: string): V1Attachment | undefined {
    return this.requestAttachments.find((attachment) => attachment.id === id)
  }
}
