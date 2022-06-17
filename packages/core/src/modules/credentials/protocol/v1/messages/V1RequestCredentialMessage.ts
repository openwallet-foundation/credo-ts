import type { CredReq } from 'indy-sdk'

import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../../../agent/AgentMessage'
import { Attachment } from '../../../../../decorators/attachment/Attachment'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'

export const INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID = 'libindy-cred-request-0'

interface RequestCredentialMessageOptions {
  id?: string
  comment?: string
  requestAttachments: Attachment[]
  attachments?: Attachment[]
}

export class V1RequestCredentialMessage extends AgentMessage {
  public constructor(options: RequestCredentialMessageOptions) {
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
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  public requestAttachments!: Attachment[]

  public get indyCredentialRequest(): CredReq | null {
    const attachment = this.requestAttachments.find(
      (attachment) => attachment.id === INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID
    )
    // Extract proof request from attachment
    const credentialReqJson = attachment?.getDataAsJson<CredReq>() ?? null

    return credentialReqJson
  }

  public getRequestAttachmentById(id: string): Attachment | undefined {
    return this.requestAttachments.find((attachment) => attachment.id === id)
  }
}
