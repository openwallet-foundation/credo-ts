import type { V2ProofFormatSpec } from '../formats/V2ProofFormat'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsString, ValidateNested, IsOptional, IsInstance } from 'class-validator'

import { AgentMessage } from '../../../../agent/AgentMessage'
import { Attachment } from '../../../../decorators/attachment/Attachment'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { ProofRequest } from '../../v1/models'
import { PRES_20_REQUEST } from '../formats/MessageTypes'

export interface V2RequestPresentationOptions {
  id?: string
  comment?: string
  requestPresentationAttachments: Attachment[]
  formats: V2ProofFormatSpec
  filtersAttach: Attachment[]
}

export const INDY_PROOF_REQUEST_ATTACHMENT_ID = 'libindy-request-presentation-0'

/**
 * Request Presentation Message part of Present Proof Protocol used to initiate request from verifier to prover.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0037-present-proof/README.md#request-presentation
 */
export class V2RequestPresentationMessage extends AgentMessage {
  public constructor(options: V2RequestPresentationOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.requestPresentationAttachments = options.requestPresentationAttachments
      this.formats = options.formats
      this.filtersAttach = options.filtersAttach
    }
  }

  @Equals(V2RequestPresentationMessage.type)
  public readonly type = V2RequestPresentationMessage.type
  public static readonly type = `https://didcomm.org/${PRES_20_REQUEST}`

  @Expose({ name: 'filters~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  public filtersAttach!: Attachment[]

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
    const proofRequestJson = attachment?.data?.getDataAsJson<ProofRequest>() ?? null
    const proofRequest = JsonTransformer.fromJSON(proofRequestJson, ProofRequest)

    return proofRequest
  }

  public formats!: V2ProofFormatSpec
}
