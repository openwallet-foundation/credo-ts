import type { CredProposeOfferRequestFormat } from '../../../formats/models/CredentialFormatServiceOptions'
import type { Cred } from 'indy-sdk'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../../../agent/AgentMessage'
import { Attachment } from '../../../../../decorators/attachment/Attachment'

export const INDY_CREDENTIAL_ATTACHMENT_ID = 'libindy-cred-0'

interface IssueCredentialMessageOptions {
  id?: string
  comment?: string
  credentialAttachments: Attachment[]
  attachments?: Attachment[]
}

export class IssueCredentialMessage extends AgentMessage {
  public constructor(options: IssueCredentialMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.credentialAttachments = options.credentialAttachments
      this.genericAttachments = options.attachments
    }
  }

  @Equals(IssueCredentialMessage.type)
  public readonly type = IssueCredentialMessage.type
  public static readonly type = 'https://didcomm.org/issue-credential/1.0/issue-credential'

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'credentials~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  public credentialAttachments!: Attachment[]

  public get indyCredential(): Cred | null {
    const attachment = this.credentialAttachments.find((attachment) => attachment.id === INDY_CREDENTIAL_ATTACHMENT_ID)

    // Extract credential from attachment
    const credentialJson = attachment?.getDataAsJson<Cred>() ?? null

    return credentialJson
  }

  /**
   * turn the message content into a reusable object to be used within the format service
   * @return CredProposeOfferRequestFormat object containing the CredPropose object
   */
  public get credentialPayload(): CredProposeOfferRequestFormat | null {
    const cred: Cred | null = this.indyCredential

    if (cred) {
      return {
        indy: {
          payload: {
            credentialPayload: cred,
          },
        },
      }
    }
    return null
  }
}
