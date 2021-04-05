import type { CredReq } from 'indy-sdk'
import { Equals, IsArray, IsString, ValidateNested } from 'class-validator'
import { AgentMessage } from '../../../agent/AgentMessage'
import { IssueCredentialMessageType } from './IssueCredentialMessageType'
import { Expose, Type } from 'class-transformer'
import { Attachment } from '../../../decorators/attachment/Attachment'
import { JsonEncoder } from '../../../utils/JsonEncoder'

export const INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID = 'libindy-cred-request-0'

interface RequestCredentialMessageOptions {
  id?: string
  comment?: string
  attachments: Attachment[]
}

export class RequestCredentialMessage extends AgentMessage {
  public constructor(options: RequestCredentialMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.comment = options.comment
      this.attachments = options.attachments
    }
  }

  @Equals(RequestCredentialMessage.type)
  public readonly type = RequestCredentialMessage.type
  public static readonly type = IssueCredentialMessageType.RequestCredential

  @IsString()
  public comment?: string

  @Expose({ name: 'requests~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  public attachments!: Attachment[]

  public get indyCredentialRequest(): CredReq | null {
    const attachment = this.attachments.find((attachment) => attachment.id === INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID)

    // Return null if attachment is not found
    if (!attachment?.data?.base64) {
      return null
    }

    // Extract proof request from attachment
    const credentialReqJson = JsonEncoder.fromBase64(attachment.data.base64)

    return credentialReqJson
  }
}
