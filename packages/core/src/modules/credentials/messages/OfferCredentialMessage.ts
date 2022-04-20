import type { CredOffer } from 'indy-sdk'

import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'
import { Attachment } from '../../../decorators/attachment/Attachment'
import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'

import { CredentialPreview } from './CredentialPreview'

export const INDY_CREDENTIAL_OFFER_ATTACHMENT_ID = 'libindy-cred-offer-0'

export interface OfferCredentialMessageOptions {
  id?: string
  comment?: string
  offerAttachments: Attachment[]
  credentialPreview: CredentialPreview
  attachments?: Attachment[]
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
      this.offerAttachments = options.offerAttachments
      this.attachments = options.attachments
    }
  }

  @IsValidMessageType(OfferCredentialMessage.type)
  public readonly type = OfferCredentialMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/1.0/offer-credential')

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'credential_preview' })
  @Type(() => CredentialPreview)
  @ValidateNested()
  @IsInstance(CredentialPreview)
  public credentialPreview!: CredentialPreview

  @Expose({ name: 'offers~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  public offerAttachments!: Attachment[]

  public get indyCredentialOffer(): CredOffer | null {
    const attachment = this.offerAttachments.find((attachment) => attachment.id === INDY_CREDENTIAL_OFFER_ATTACHMENT_ID)

    // Extract credential offer from attachment
    const credentialOfferJson = attachment?.getDataAsJson<CredOffer>() ?? null

    return credentialOfferJson
  }
}
