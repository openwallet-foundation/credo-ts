import type { V2ProofFormatSpec } from '../formats/V2ProofFormat'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../../agent/AgentMessage'
import { Attachment } from '../../../../decorators/attachment/Attachment'
import { PresentationPreview } from '../../v1/models/PresentationPreview'
import { PRES_20_PROPOSAL } from '../formats/MessageTypes'

export interface V2ProposePresentationMessageOptions {
  id: string
  formats: V2ProofFormatSpec
  filtersAttach: Attachment[]
  comment?: string
  presentationProposal: PresentationPreview
}

export class V2ProposalPresentationMessage extends AgentMessage {
  public constructor(options: V2ProposePresentationMessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.presentationProposal = options.presentationProposal
      this.formats = options.formats
      this.filtersAttach = options.filtersAttach
    }
  }

  @Equals(V2ProposalPresentationMessage.type)
  public readonly type = V2ProposalPresentationMessage.type
  public static readonly type = `https://didcomm.org/${PRES_20_PROPOSAL}`

  @Expose({ name: 'filters~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  public filtersAttach!: Attachment[]

  /**
   * Provides some human readable information about the proposed presentation.
   */
  @IsString()
  @IsOptional()
  public comment?: string

  /**
   * Represents the presentation example that prover wants to provide.
   */
  @Expose({ name: 'presentation_proposal' })
  @Type(() => PresentationPreview)
  @ValidateNested()
  @IsInstance(PresentationPreview)
  public presentationProposal!: PresentationPreview

  public formats!: V2ProofFormatSpec
}
