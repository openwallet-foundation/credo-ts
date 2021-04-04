import type { CredOffer } from 'indy-sdk'
import { Equals, IsArray, IsString, ValidateNested } from 'class-validator'
import { Expose, Type } from 'class-transformer'

import { AgentMessage } from '../../../agent/AgentMessage'
import { IssueCredentialMessageType } from './IssueCredentialMessageType'
import { Attachment } from '../../../decorators/attachment/Attachment'
import { CredentialPreview } from './CredentialPreview'
import { JsonEncoder } from '../../../utils/JsonEncoder'

export const INDY_CREDENTIAL_OFFER_ATTACHMENT_ID = 'libindy-cred-offer-0'

export interface OfferCredentialMessageOptions {
  id?: string
  comment?: string
  attachments: Attachment[]
  credentialPreview: CredentialPreview
}

/**
 * Message part of Issue Credential Protocol used to continue or initiate credential exchange by issuer.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0036-issue-credential/README.md#offer-credential
 */
export class OfferCredentialMessage extends AgentMessage {
  public constructor(options: OfferCredentialMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.comment = options.comment
      this.credentialPreview = options.credentialPreview
      this.attachments = options.attachments
    }
  }

  @Equals(OfferCredentialMessage.type)
  public readonly type = OfferCredentialMessage.type
  public static readonly type = IssueCredentialMessageType.OfferCredential

  @IsString()
  public comment?: string

  @Expose({ name: 'credential_preview' })
  @Type(() => CredentialPreview)
  @ValidateNested()
  public credentialPreview!: CredentialPreview

  @Expose({ name: 'offers~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  public attachments!: Attachment[]

  public get indyCredentialOffer(): CredOffer | null {
    const attachment = this.attachments.find((attachment) => attachment.id === INDY_CREDENTIAL_OFFER_ATTACHMENT_ID)

    // Return null if attachment is not found
    if (!attachment?.data?.base64) {
      return null
    }

    // Extract credential offer from attachment
    const credentialOfferJson = JsonEncoder.fromBase64(attachment.data.base64)

    return credentialOfferJson
  }
}
