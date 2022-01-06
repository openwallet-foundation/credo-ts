import { V2CredentialFormatSpec } from "../formats/V2CredentialFormat"
import { Attachment } from '../../../../decorators/attachment/Attachment'
import { Equals, IsArray, IsInstance, ValidateNested } from 'class-validator'
import { AgentMessage } from '../../../../agent/AgentMessage'
import { V2CredentialPreview } from '../V2CredentialPreview'
import { CRED_20_PROPOSAL } from "../formats/MessageTypes"
import { Expose, Type } from "class-transformer"

export class V2ProposeCredentialMessage extends AgentMessage {

  public comment?: string
  public credentialProposal?: V2CredentialPreview
  public formats: V2CredentialFormatSpec
  public credentialDefinitionId?: string

  constructor(id: string, 
    formats: V2CredentialFormatSpec,
    filtersAttach: Attachment[],
    comment?: string,
    credentialDefinitionId?: string,
    credentialPreview?: V2CredentialPreview,) {
    super()
    this.id = id
    this.comment = comment
    this.credentialProposal = credentialPreview
    this.formats = formats
    this.filtersAttach = filtersAttach
    this.credentialDefinitionId = credentialDefinitionId
  }

  @Equals(V2ProposeCredentialMessage.type)
  public readonly type = V2ProposeCredentialMessage.type
  public static readonly type = CRED_20_PROPOSAL

  @Expose({ name: 'filters~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  public filtersAttach!: Attachment[]
}