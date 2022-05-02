import type { ProofAttachmentFormat } from '../../../formats/models/ProofAttachmentFormat'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsString, ValidateNested, IsOptional, IsInstance } from 'class-validator'

import { AgentMessage } from '../../../../../agent/AgentMessage'
import { Attachment } from '../../../../../decorators/attachment/Attachment'
import { AriesFrameworkError } from '../../../../../error/AriesFrameworkError'
import { JsonTransformer } from '../../../../../utils/JsonTransformer'
import { V2_INDY_PRESENTATION_REQUEST } from '../../../formats/ProofFormats'
import { ProofRequest } from '../../../formats/indy/models/ProofRequest'
import { ProofFormatSpec } from '../../../formats/models/ProofFormatSpec'

export interface RequestPresentationOptions {
  id?: string
  comment?: string
  requestPresentationAttachments: Attachment[]
}

export const INDY_PROOF_REQUEST_ATTACHMENT_ID = 'libindy-request-presentation-0'

/**
 * Request Presentation Message part of Present Proof Protocol used to initiate request from verifier to prover.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0037-present-proof/README.md#request-presentation
 */
export class V1RequestPresentationMessage extends AgentMessage {
  public constructor(options: RequestPresentationOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.requestPresentationAttachments = options.requestPresentationAttachments
    }
  }

  @Equals(V1RequestPresentationMessage.type)
  public readonly type = V1RequestPresentationMessage.type
  public static readonly type = 'https://didcomm.org/present-proof/1.0/request-presentation'

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

  public getAttachmentFormats(): ProofAttachmentFormat[] {
    const attachment = this.indyAttachment

    if (!attachment) {
      throw new AriesFrameworkError(`Could not find a request presentation attachment`)
    }

    return [
      {
        format: new ProofFormatSpec({ format: V2_INDY_PRESENTATION_REQUEST }),
        attachment: attachment,
      },
    ]
  }

  public get indyAttachment(): Attachment | null {
    return (
      this.requestPresentationAttachments.find((attachment) => attachment.id === INDY_PROOF_REQUEST_ATTACHMENT_ID) ??
      null
    )
  }
}
