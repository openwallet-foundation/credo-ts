import { Expose, Type } from 'class-transformer'
import { IsArray, IsString, ValidateNested, IsOptional, IsInstance } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'
import { Attachment } from '../../../decorators/attachment/Attachment'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'
import { ProofRequest } from '../models'

export interface RequestPresentationOptions {
  id?: string
  comment?: string
  parentThreadId?: string
  requestPresentationAttachments: Attachment[]
}

export const INDY_PROOF_REQUEST_ATTACHMENT_ID = 'libindy-request-presentation-0'

/**
 * Request Presentation Message part of Present Proof Protocol used to initiate request from verifier to prover.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0037-present-proof/README.md#request-presentation
 */
export class RequestPresentationMessage extends AgentMessage {
  public constructor(options: RequestPresentationOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.requestPresentationAttachments = options.requestPresentationAttachments
      if (options.parentThreadId) {
        this.setThread({
          threadId: this.id,
          parentThreadId: options.parentThreadId,
        })
      }
    }
  }

  @IsValidMessageType(RequestPresentationMessage.type)
  public readonly type = RequestPresentationMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/present-proof/1.0/request-presentation')

  /**
   *  Provides some human readable information about this request for a presentation.
   */
  @IsOptional()
  @IsString()
  public comment?: string

  /**
   * An array of attachments defining the acceptable formats for the presentation.
   */
  @Expose({ name: 'request_presentations~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  public requestPresentationAttachments!: Attachment[]

  public get indyProofRequest(): ProofRequest | null {
    const attachment = this.requestPresentationAttachments.find(
      (attachment) => attachment.id === INDY_PROOF_REQUEST_ATTACHMENT_ID
    )
    // Extract proof request from attachment
    const proofRequestJson = attachment?.getDataAsJson<ProofRequest>() ?? null
    const proofRequest = JsonTransformer.fromJSON(proofRequestJson, ProofRequest)

    return proofRequest
  }
}
