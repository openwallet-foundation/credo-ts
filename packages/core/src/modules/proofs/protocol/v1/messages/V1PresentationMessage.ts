import type { ProofAttachmentFormat } from '../../../formats/models/ProofAttachmentFormat'
import type { IndyProof } from 'indy-sdk'

import { Expose, Type } from 'class-transformer'
import { IsArray, IsString, ValidateNested, IsOptional, IsInstance } from 'class-validator'

import { AgentMessage } from '../../../../../agent/AgentMessage'
import { Attachment } from '../../../../../decorators/attachment/Attachment'
import { AriesFrameworkError } from '../../../../../error/AriesFrameworkError'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
import { V2_INDY_PRESENTATION } from '../../../formats/ProofFormats'
import { ProofFormatSpec } from '../../../formats/models/ProofFormatSpec'

export const INDY_PROOF_ATTACHMENT_ID = 'libindy-presentation-0'

export interface PresentationOptions {
  id?: string
  comment?: string
  presentationAttachments: Attachment[]
  attachments?: Attachment[]
}

/**
 * Presentation Message part of Present Proof Protocol used as a response to a {@link PresentationRequestMessage | Presentation Request Message} from prover to verifier.
 * Contains signed presentations.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0037-present-proof/README.md#presentation
 */
export class V1PresentationMessage extends AgentMessage {
  public constructor(options: PresentationOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.presentationAttachments = options.presentationAttachments
      this.appendedAttachments = options.attachments
    }
  }

  @IsValidMessageType(V1PresentationMessage.type)
  public readonly type = V1PresentationMessage.type.messageTypeUri
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
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  public presentationAttachments!: Attachment[]

  public getAttachmentFormats(): ProofAttachmentFormat[] {
    const attachment = this.indyAttachment

    if (!attachment) {
      throw new AriesFrameworkError(`Could not find a presentation attachment`)
    }

    return [
      {
        format: new ProofFormatSpec({ format: V2_INDY_PRESENTATION }),
        attachment: attachment,
      },
    ]
  }

  public get indyAttachment(): Attachment | null {
    return this.presentationAttachments.find((attachment) => attachment.id === INDY_PROOF_ATTACHMENT_ID) ?? null
  }

  public get indyProof(): IndyProof | null {
    const attachment = this.indyAttachment

    const proofJson = attachment?.getDataAsJson<IndyProof>() ?? null

    return proofJson
  }
}
