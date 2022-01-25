import type { ProofFormatSpec } from '../../../formats/models/ProofFormatServiceOptions'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../../../agent/AgentMessage'
import { uuid } from '../../../../../utils/uuid'
import { PresentationPreview } from '../../v1/models/PresentationPreview'

import { Attachment } from 'packages/core/src/decorators/attachment/Attachment'

export interface V2ProposePresentationMessageOptions {
  id?: string
  formats: ProofFormatSpec
  filtersAttach: Attachment[]
  comment?: string
  presentationProposal: PresentationPreview
}

export class V2ProposalPresentationMessage extends AgentMessage {
  public constructor(options: V2ProposePresentationMessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? uuid()
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

  public formats!: ProofFormatSpec
}
