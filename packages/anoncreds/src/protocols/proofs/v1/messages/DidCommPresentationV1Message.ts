import { DidCommAttachment, DidCommMessage, IsValidMessageType, parseMessageType } from '@credo-ts/didcomm'
import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'
import type { AnonCredsProof } from '../../../../models'

export const INDY_PROOF_ATTACHMENT_ID = 'libindy-presentation-0'

export interface DidCommPresentationV1MessageOptions {
  id?: string
  comment?: string
  presentationAttachments: DidCommAttachment[]
  attachments?: DidCommAttachment[]
}

/**
 * Presentation Message part of Present Proof Protocol used as a response to a {@link PresentationRequestMessage | Presentation Request Message} from prover to verifier.
 * Contains signed presentations.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0037-present-proof/README.md#presentation
 */
export class DidCommPresentationV1Message extends DidCommMessage {
  public readonly allowDidSovPrefix = true
  public constructor(options: DidCommPresentationV1MessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.presentationAttachments = options.presentationAttachments
      this.appendedAttachments = options.attachments
    }
  }

  @IsValidMessageType(DidCommPresentationV1Message.type)
  public readonly type = DidCommPresentationV1Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/present-proof/1.0/presentation')

  /**
   *  Provides some human readable information about this request for a presentation.
   */
  @IsOptional()
  @IsString()
  public comment?: string

  /**
   * An array of attachments containing the presentation in the requested format(s).
   */
  @Expose({ name: 'presentations~attach' })
  @Type(() => DidCommAttachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(DidCommAttachment, { each: true })
  public presentationAttachments!: DidCommAttachment[]

  public get indyProof(): AnonCredsProof | null {
    const attachment =
      this.presentationAttachments.find((attachment) => attachment.id === INDY_PROOF_ATTACHMENT_ID) ?? null

    const proofJson = attachment?.getDataAsJson<AnonCredsProof>() ?? null

    return proofJson
  }

  public getPresentationAttachmentById(id: string): DidCommAttachment | undefined {
    return this.presentationAttachments.find((attachment) => attachment.id === id)
  }
}
