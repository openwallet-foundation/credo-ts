import type { V2CredentialFormatSpec } from '../formats/V2CredentialFormat'
import type { CredOffer } from 'indy-sdk'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../../agent/AgentMessage'
import { Attachment } from '../../../../decorators/attachment/Attachment'
import { V2CredentialPreview } from '../V2CredentialPreview'

export interface V2OfferCredentialMessageOptions {
  id: string
  formats: V2CredentialFormatSpec[]
  offerAttachments: Attachment[]
  credentialPreview?: V2CredentialPreview
  replacementId: string
  comment?: string
}

export const CRED_20_OFFER = 'https://didcomm.org/issue-credential/2.0/offer-credential'

export class V2OfferCredentialMessage extends AgentMessage {
  public formats!: V2CredentialFormatSpec[]

  public constructor(options: V2OfferCredentialMessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.formats = options.formats
      this.credentialPreview = options.credentialPreview
      this.attachments = options.offerAttachments
    }
  }

  @Equals(V2OfferCredentialMessage.type)
  public readonly type = V2OfferCredentialMessage.type
  public static readonly type = CRED_20_OFFER

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'credential_preview' })
  @Type(() => V2CredentialPreview)
  @ValidateNested()
  @IsInstance(V2CredentialPreview)
  public credentialPreview?: V2CredentialPreview

  @Expose({ name: 'offers~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  public attachments!: Attachment[]

  @Expose({ name: 'replacement_id' })
  @IsString()
  @IsOptional()
  public replacementId?: string

  // this is needed for the CredentialResponseCoordinator (which needs reworking into V1 and V2 versions)
  // MJR-TODO rework CredentialResponseCoordinator for new V2 architecture
  public get indyCredentialOffer(): CredOffer | null {
    return null
  }
}
