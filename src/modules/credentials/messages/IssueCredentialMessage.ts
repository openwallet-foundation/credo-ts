import type { Cred } from 'indy-sdk'
import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'
import { Attachment } from '../../../decorators/attachment/Attachment'
import { JsonEncoder } from '../../../utils/JsonEncoder'
import { IssueCredentialMessageType } from './IssueCredentialMessageType'

export const INDY_CREDENTIAL_ATTACHMENT_ID = 'libindy-cred-0'

interface IssueCredentialMessageOptions {
  id?: string
  comment?: string
  attachments: Attachment[]
}

export class IssueCredentialMessage extends AgentMessage {
  public constructor(options: IssueCredentialMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.attachments = options.attachments
    }
  }

  @Equals(IssueCredentialMessage.type)
  public readonly type = IssueCredentialMessage.type
  public static readonly type = IssueCredentialMessageType.IssueCredential

  @IsString()
  public comment?: string

  @Expose({ name: 'credentials~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  public attachments!: Attachment[]

  public get indyCredential(): Cred | null {
    const attachment = this.attachments.find((attachment) => attachment.id === INDY_CREDENTIAL_ATTACHMENT_ID)

    // Return null if attachment is not found
    if (!attachment?.data?.base64) {
      return null
    }

    // Extract credential from attachment
    const credentialJson = JsonEncoder.fromBase64(attachment.data.base64)

    return credentialJson
  }
}
