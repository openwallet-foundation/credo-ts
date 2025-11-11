import { DidCommAttachment, DidCommMessage, IsValidMessageType, parseMessageType } from '@credo-ts/didcomm'
import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'
import type { LegacyIndyProofRequest } from '../../../../formats'

export interface DidCommRequestPresentationV1MessageOptions {
  id?: string
  comment?: string
  requestAttachments: DidCommAttachment[]
}

export const INDY_PROOF_REQUEST_ATTACHMENT_ID = 'libindy-request-presentation-0'

/**
 * Request Presentation Message part of Present Proof Protocol used to initiate request from verifier to prover.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0037-present-proof/README.md#request-presentation
 */
export class DidCommRequestPresentationV1Message extends DidCommMessage {
  public readonly allowDidSovPrefix = true

  public constructor(options: DidCommRequestPresentationV1MessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.requestAttachments = options.requestAttachments
    }
  }

  @IsValidMessageType(DidCommRequestPresentationV1Message.type)
  public readonly type = DidCommRequestPresentationV1Message.type.messageTypeUri
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
  @Type(() => DidCommAttachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(DidCommAttachment, { each: true })
  public requestAttachments!: DidCommAttachment[]

  public get indyProofRequest(): LegacyIndyProofRequest | null {
    const attachment = this.requestAttachments.find((attachment) => attachment.id === INDY_PROOF_REQUEST_ATTACHMENT_ID)
    // Extract proof request from attachment
    return attachment?.getDataAsJson<LegacyIndyProofRequest>() ?? null
  }

  public getRequestAttachmentById(id: string): DidCommAttachment | undefined {
    return this.requestAttachments.find((attachment) => attachment.id === id)
  }
}
