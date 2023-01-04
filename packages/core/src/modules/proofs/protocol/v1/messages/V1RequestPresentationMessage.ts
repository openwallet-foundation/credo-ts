import type { ProofAttachmentFormat } from '../../../formats/models/ProofAttachmentFormat'
import type { IndyProofRequest } from 'indy-sdk'

import { Expose, Type } from 'class-transformer'
import { IsArray, IsString, ValidateNested, IsOptional, IsInstance } from 'class-validator'

import { V1Attachment } from '../../../../../decorators/attachment/V1Attachment'
import { DidCommV1Message } from '../../../../../didcomm'
import { AriesFrameworkError } from '../../../../../error/AriesFrameworkError'
import { JsonTransformer } from '../../../../../utils/JsonTransformer'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
import { V2_INDY_PRESENTATION_REQUEST } from '../../../formats/ProofFormatConstants'
import { ProofRequest } from '../../../formats/indy/models/ProofRequest'
import { ProofFormatSpec } from '../../../models/ProofFormatSpec'

export interface RequestPresentationOptions {
  id?: string
  comment?: string
  parentThreadId?: string
  requestPresentationAttachments: V1Attachment[]
}

export const INDY_PROOF_REQUEST_ATTACHMENT_ID = 'libindy-request-presentation-0'

/**
 * Request Presentation Message part of Present Proof Protocol used to initiate request from verifier to prover.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0037-present-proof/README.md#request-presentation
 */
export class V1RequestPresentationMessage extends DidCommV1Message {
  public constructor(options: RequestPresentationOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.requestPresentationAttachments = options.requestPresentationAttachments
      if (options.parentThreadId) {
        this.setThread({
          parentThreadId: options.parentThreadId,
        })
      }
    }
  }

  @IsValidMessageType(V1RequestPresentationMessage.type)
  public readonly type = V1RequestPresentationMessage.type.messageTypeUri
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
  @Type(() => V1Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(V1Attachment, { each: true })
  public requestPresentationAttachments!: V1Attachment[]

  public get indyProofRequest(): ProofRequest | null {
    // Extract proof request from attachment
    const proofRequestJson = this.indyProofRequestJson
    const proofRequest = JsonTransformer.fromJSON(proofRequestJson, ProofRequest)

    return proofRequest
  }

  public get indyProofRequestJson(): IndyProofRequest | null {
    const attachment = this.requestPresentationAttachments.find(
      (attachment) => attachment.id === INDY_PROOF_REQUEST_ATTACHMENT_ID
    )
    // Extract proof request from attachment
    return attachment?.getDataAsJson<IndyProofRequest>() ?? null
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

  public get indyAttachment(): V1Attachment | null {
    return (
      this.requestPresentationAttachments.find((attachment) => attachment.id === INDY_PROOF_REQUEST_ATTACHMENT_ID) ??
      null
    )
  }
}
