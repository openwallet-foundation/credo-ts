import { DidCommAttachment, DidCommMessage, IsValidMessageType, parseMessageType } from '@credo-ts/didcomm'
import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'
import type { AnonCredsCredentialOffer } from '../../../../models'

import { DidCommCredentialV1Preview } from './DidCommCredentialV1Preview'

export const INDY_CREDENTIAL_OFFER_ATTACHMENT_ID = 'libindy-cred-offer-0'

export interface DidCommOfferCredentialV1Message {
  id?: string
  comment?: string
  offerAttachments: DidCommAttachment[]
  credentialPreview: DidCommCredentialV1Preview
  attachments?: DidCommAttachment[]
}

/**
 * Message part of Issue Credential Protocol used to continue or initiate credential exchange by issuer.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0036-issue-credential/README.md#offer-credential
 */
export class V1OfferCredentialMessage extends DidCommMessage {
  public readonly allowDidSovPrefix = true

  public constructor(options: DidCommOfferCredentialV1Message) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.comment = options.comment
      this.credentialPreview = options.credentialPreview
      this.offerAttachments = options.offerAttachments
      this.appendedAttachments = options.attachments
    }
  }

  @IsValidMessageType(V1OfferCredentialMessage.type)
  public readonly type = V1OfferCredentialMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/1.0/offer-credential')

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'credential_preview' })
  @Type(() => DidCommCredentialV1Preview)
  @ValidateNested()
  @IsInstance(DidCommCredentialV1Preview)
  public credentialPreview!: DidCommCredentialV1Preview

  @Expose({ name: 'offers~attach' })
  @Type(() => DidCommAttachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(DidCommAttachment, { each: true })
  public offerAttachments!: DidCommAttachment[]

  public get indyCredentialOffer(): AnonCredsCredentialOffer | null {
    const attachment = this.offerAttachments.find((attachment) => attachment.id === INDY_CREDENTIAL_OFFER_ATTACHMENT_ID)

    // Extract credential offer from attachment
    const credentialOfferJson = attachment?.getDataAsJson<AnonCredsCredentialOffer>() ?? null

    return credentialOfferJson
  }

  public getOfferAttachmentById(id: string): DidCommAttachment | undefined {
    return this.offerAttachments.find((attachment) => attachment.id === id)
  }
}
