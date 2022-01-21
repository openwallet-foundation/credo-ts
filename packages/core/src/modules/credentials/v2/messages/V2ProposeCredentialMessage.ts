import type { V2CredentialFormatSpec } from '../formats/V2CredentialFormat'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../../agent/AgentMessage'
import { Attachment } from '../../../../decorators/attachment/Attachment'
import { V2CredentialPreview } from '../V2CredentialPreview'

export const CRED_20_PROPOSAL = 'https://didcomm.org/issue-credential/2.0/propose-credential'

export interface V2ProposeCredentialMessageProps {
  id: string
  formats: V2CredentialFormatSpec[]
  filtersAttach: Attachment[]
  comment?: string
  credentialProposal?: V2CredentialPreview
}

export class V2ProposeCredentialMessage extends AgentMessage {
  public formats!: V2CredentialFormatSpec[]

  public constructor(props: V2ProposeCredentialMessageProps) {
    super()
    if (props) {
      this.id = props.id ?? this.generateId()
      this.comment = props.comment
      this.credentialProposal = props.credentialProposal
      this.formats = props.formats
      this.filtersAttach = props.filtersAttach
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
}
