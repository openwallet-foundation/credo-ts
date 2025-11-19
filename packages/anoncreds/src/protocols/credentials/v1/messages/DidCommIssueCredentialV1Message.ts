import { DidCommAttachment, DidCommMessage, IsValidMessageType, parseMessageType } from '@credo-ts/didcomm'
import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'
import type { AnonCredsCredential } from '../../../../models'

export const INDY_CREDENTIAL_ATTACHMENT_ID = 'libindy-cred-0'

export interface V1IssueCredentialMessageOptions {
  id?: string
  comment?: string
  credentialAttachments: DidCommAttachment[]
  attachments?: DidCommAttachment[]
}

export class DidCommIssueCredentialV1Message extends DidCommMessage {
  public readonly allowDidSovPrefix = true

  public constructor(options: V1IssueCredentialMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.credentialAttachments = options.credentialAttachments
      this.appendedAttachments = options.attachments
    }
  }

  @IsValidMessageType(DidCommIssueCredentialV1Message.type)
  public readonly type = DidCommIssueCredentialV1Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/1.0/issue-credential')

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'credentials~attach' })
  @Type(() => DidCommAttachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(DidCommAttachment, { each: true })
  public credentialAttachments!: DidCommAttachment[]

  public get indyCredential(): AnonCredsCredential | null {
    const attachment = this.credentialAttachments.find((attachment) => attachment.id === INDY_CREDENTIAL_ATTACHMENT_ID)

    // Extract credential from attachment
    const credentialJson = attachment?.getDataAsJson<AnonCredsCredential>() ?? null

    return credentialJson
  }

  public getCredentialAttachmentById(id: string): DidCommAttachment | undefined {
    return this.credentialAttachments.find((attachment) => attachment.id === id)
  }
}
