import type { AnonCredsCredential } from '../../../../models'

import { DidCommV1Message, IsValidMessageType, parseMessageType, V1Attachment } from '@aries-framework/core'
import { Expose, Type } from 'class-transformer'
import { IsString, IsOptional, IsArray, ValidateNested, IsInstance } from 'class-validator'

export const INDY_CREDENTIAL_ATTACHMENT_ID = 'libindy-cred-0'

export interface V1IssueCredentialMessageOptions {
  id?: string
  comment?: string
  credentialAttachments: V1Attachment[]
  attachments?: V1Attachment[]
}

export class V1IssueCredentialMessage extends DidCommV1Message {
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

  @IsValidMessageType(V1IssueCredentialMessage.type)
  public readonly type = V1IssueCredentialMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/1.0/issue-credential')

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'credentials~attach' })
  @Type(() => V1Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(V1Attachment, { each: true })
  public credentialAttachments!: V1Attachment[]

  public get indyCredential(): AnonCredsCredential | null {
    const attachment = this.credentialAttachments.find((attachment) => attachment.id === INDY_CREDENTIAL_ATTACHMENT_ID)

    // Extract credential from attachment
    const credentialJson = attachment?.getDataAsJson<AnonCredsCredential>() ?? null

    return credentialJson
  }

  public getCredentialAttachmentById(id: string): V1Attachment | undefined {
    return this.credentialAttachments.find((attachment) => attachment.id == id)
  }
}
