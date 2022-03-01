import type { CredOffer } from 'indy-sdk'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../../../agent/AgentMessage'
import { Attachment } from '../../../../../decorators/attachment/Attachment'
import { V1CredentialPreview } from '../V1CredentialPreview'

export const INDY_CREDENTIAL_OFFER_ATTACHMENT_ID = 'libindy-cred-offer-0'

export interface OfferCredentialMessageOptions {
  id?: string
  comment?: string
  offerAttachments: Attachment[]
  credentialPreview: V1CredentialPreview
  attachments?: Attachment[]
}

/**
 * Message part of Issue Credential Protocol used to continue or initiate credential exchange by issuer.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0036-issue-credential/README.md#offer-credential
 */
export class V1OfferCredentialMessage extends AgentMessage {
  public constructor(options: OfferCredentialMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.comment = options.comment
      this.credentialPreview = options.credentialPreview
      this.messageAttachments = options.offerAttachments
      this.appendedAttachments = options.attachments
    }
  }

  @Equals(V1OfferCredentialMessage.type)
  public readonly type = V1OfferCredentialMessage.type
  public static readonly type = 'https://didcomm.org/issue-credential/1.0/offer-credential'

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'credential_preview' })
  @Type(() => V1CredentialPreview)
  @ValidateNested()
  @IsInstance(V1CredentialPreview)
  public credentialPreview!: V1CredentialPreview

  @Expose({ name: 'offers~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  public messageAttachments!: Attachment[]

  public get indyCredentialOffer(): CredOffer | null {
    const attachment = this.messageAttachments.find(
      (attachment) => attachment.id === INDY_CREDENTIAL_OFFER_ATTACHMENT_ID
    )

    // Extract credential offer from attachment
    const credentialOfferJson = attachment?.getDataAsJson<CredOffer>() ?? null

    return credentialOfferJson
  }

  public getAttachmentIncludingFormatId(id: string): Attachment | undefined {
    return this.messageAttachments?.find((attachment) => attachment.id.includes(id))
  }
}
