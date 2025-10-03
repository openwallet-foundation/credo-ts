import type { LegacyIndyCredentialRequest } from '../../../../formats'

import { DidCommAttachment, DidCommMessage, IsValidMessageType, parseMessageType } from '@credo-ts/didcomm'
import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

export const INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID = 'libindy-cred-request-0'

export interface DidCommRequestCredentialV1MessageOptions {
  id?: string
  comment?: string
  requestAttachments: DidCommAttachment[]
  attachments?: DidCommAttachment[]
}

export class DidCommRequestCredentialV1Message extends DidCommMessage {
  public readonly allowDidSovPrefix = true

  public constructor(options: DidCommRequestCredentialV1MessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.comment = options.comment
      this.requestAttachments = options.requestAttachments
      this.appendedAttachments = options.attachments
    }
  }

  @IsValidMessageType(DidCommRequestCredentialV1Message.type)
  public readonly type = DidCommRequestCredentialV1Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/1.0/request-credential')

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'requests~attach' })
  @Type(() => DidCommAttachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(DidCommAttachment, { each: true })
  public requestAttachments!: DidCommAttachment[]

  public get indyCredentialRequest(): LegacyIndyCredentialRequest | null {
    const attachment = this.requestAttachments.find(
      (attachment) => attachment.id === INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID
    )
    // Extract proof request from attachment
    const credentialReqJson = attachment?.getDataAsJson<LegacyIndyCredentialRequest>() ?? null

    return credentialReqJson
  }

  public getRequestAttachmentById(id: string): DidCommAttachment | undefined {
    return this.requestAttachments.find((attachment) => attachment.id === id)
  }
}
