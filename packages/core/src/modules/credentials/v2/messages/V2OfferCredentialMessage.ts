import { V2CredentialFormatSpec } from "../formats/V2CredentialFormat"
import { Attachment } from '../../../../decorators/attachment/Attachment'
import { Equals, IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'
import { AgentMessage } from '../../../../agent/AgentMessage'
import { CredentialPreview } from '../../CredentialPreview'
import { CRED_20_OFFER } from "../formats/MessageTypes"
import { CredOffer } from "indy-sdk"
import { Expose, Type } from "class-transformer"


export const INDY_CREDENTIAL_OFFER_ATTACHMENT_ID = 'indy'

export class V2OfferCredentialMessage extends AgentMessage {

  public formats: V2CredentialFormatSpec
  public replacementId: string // credential exchange record id MJR-TODO ask Timo


  constructor(id: string, 
    formats: V2CredentialFormatSpec,
    comment: string,
    offersAttach: Attachment[],
    replacementId: string,
    credentialPreview: CredentialPreview) {
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
    return null
  }
}