import { DidCommMessage, IsValidMessageType, parseMessageType } from '@credo-ts/didcomm'
import { Expose, Type } from 'class-transformer'
import { IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { DidCommPresentationV1Preview } from '../models/DidCommPresentationV1Preview'

export interface DidCommProposePresentationV1MessageOptions {
  id?: string
  comment?: string
  presentationProposal: DidCommPresentationV1Preview
}

/**
 * Propose Presentation Message part of Present Proof Protocol used to initiate presentation exchange by holder.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0037-present-proof/README.md#propose-presentation
 */
export class DidCommProposePresentationV1Message extends DidCommMessage {
  public readonly allowDidSovPrefix = true
  public constructor(options: DidCommProposePresentationV1MessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.presentationProposal = options.presentationProposal
    }
  }

  @IsValidMessageType(DidCommProposePresentationV1Message.type)
  public readonly type = DidCommProposePresentationV1Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/present-proof/1.0/propose-presentation')

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
  @Type(() => DidCommPresentationV1Preview)
  @ValidateNested()
  @IsInstance(DidCommPresentationV1Preview)
  public presentationProposal!: DidCommPresentationV1Preview
}
