import type { V2CredentialFormatSpec } from '../formats/V2CredentialFormat'
import type { CredOffer } from 'indy-sdk'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../../agent/AgentMessage'
import { Attachment } from '../../../../decorators/attachment/Attachment'
import { V2CredentialPreview } from '../V2CredentialPreview'
import { CRED_20_OFFER } from '../formats/MessageTypes'

export class V2OfferCredentialMessage extends AgentMessage {
  public formats: V2CredentialFormatSpec

  public constructor(
    id: string,
    formats: V2CredentialFormatSpec,
    comment: string,
    offersAttach: Attachment[],
    replacementId: string,
    credentialPreview: V2CredentialPreview
  ) {
    super()
    this.id = id
    this.comment = comment
    this.credentialPreview = credentialPreview
    this.formats = formats
    this.offerAttachments = offersAttach
    this.replacementId = replacementId
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
  public credentialPreview!: V2CredentialPreview

  @Expose({ name: 'offers~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  public offerAttachments!: Attachment[]

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
