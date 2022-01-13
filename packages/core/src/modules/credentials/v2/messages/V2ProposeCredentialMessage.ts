import type { V2CredentialFormatSpec } from '../formats/V2CredentialFormat'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../../agent/AgentMessage'
import { Attachment } from '../../../../decorators/attachment/Attachment'
import { V2CredentialPreview } from '../V2CredentialPreview'
import { CRED_20_PROPOSAL } from '../formats/MessageTypes'

export interface V2ProposeCredentialMessageOptions {
  id: string
  formats: V2CredentialFormatSpec
  filtersAttach: Attachment[]
  comment?: string
  credentialDefinitionId?: string
  credentialProposal?: V2CredentialPreview
}

export class V2ProposeCredentialMessage extends AgentMessage {
  public formats!: V2CredentialFormatSpec

  public constructor(options: V2ProposeCredentialMessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.credentialProposal = options.credentialProposal

      this.credentialDefinitionId = options.credentialDefinitionId
      this.formats = options.formats
      this.filtersAttach = options.filtersAttach
      this.credentialDefinitionId = options.credentialDefinitionId
    }
  }

  @Equals(V2ProposeCredentialMessage.type)
  public readonly type = V2ProposeCredentialMessage.type
  public static readonly type = CRED_20_PROPOSAL

  @Expose({ name: 'credential_proposal' })
  @Type(() => V2CredentialPreview)
  @ValidateNested()
  @IsOptional()
  @IsInstance(V2CredentialPreview)
  public credentialProposal?: V2CredentialPreview

  @Expose({ name: 'filters~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  public filtersAttach!: Attachment[]

  /**
   * Human readable information about this Credential Proposal,
   * so the proposal can be evaluated by human judgment.
   */
  @IsOptional()
  @IsString()
  public comment?: string
  /**
   * Filter to request credential based on a particular Credential Definition.
   */
  @Expose({ name: 'cred_def_id' })
  @IsString()
  @IsOptional()
  public credentialDefinitionId?: string
}
