import type { PresentationPreview } from '../../PresentationPreview'
import type { V2ProofFormatSpec } from '../formats/V2ProofFormat'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsInstance, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../../agent/AgentMessage'
import { Attachment } from '../../../../decorators/attachment/Attachment'
import { PRES_20_PROPOSAL } from '../formats/MessageTypes'

export class V2ProposalPresentationMessage extends AgentMessage {
  private comment?: string
  private presentationProposal?: PresentationPreview
  private formats: V2ProofFormatSpec

  public constructor(
    id: string,
    formats: V2ProofFormatSpec,
    filtersAttach: Attachment[],
    comment?: string,
    presentationProposal?: PresentationPreview
  ) {
    super()
    this.id = id
    this.comment = comment
    this.presentationProposal = presentationProposal
    this.formats = formats
    this.filtersAttach = filtersAttach
  }

  @Equals(V2ProposalPresentationMessage.type)
  public readonly type = V2ProposalPresentationMessage.type
  public static readonly type = PRES_20_PROPOSAL

  @Expose({ name: 'filters~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  public filtersAttach!: Attachment[]
}
