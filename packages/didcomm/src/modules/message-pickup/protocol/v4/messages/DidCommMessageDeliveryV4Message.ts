import { Expose } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import type { DidCommAttachment } from '../../../../../decorators/attachment/DidCommAttachment'
import type { DidCommVersion } from '../../../../../util/didcommVersion'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'
import { mapV1AttachmentToV2 } from '../../../../../v2/plaintextBuilder'
import type { DidCommV2PlaintextMessage } from '../../../../../v2/types'

export interface DidCommMessageDeliveryV4MessageOptions {
  id?: string
  recipientDid?: string
  threadId?: string
  attachments: DidCommAttachment[]
}

export class DidCommMessageDeliveryV4Message extends DidCommMessage {
  public readonly allowQueueTransport = false
  public readonly supportedDidCommVersions: DidCommVersion[] = ['v2']

  public constructor(options: DidCommMessageDeliveryV4MessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.recipientDid = options.recipientDid
      this.appendedAttachments = options.attachments
      if (options.threadId) {
        this.setThread({
          threadId: options.threadId,
        })
      }
    }
  }

  @IsValidMessageType(DidCommMessageDeliveryV4Message.type)
  public readonly type = DidCommMessageDeliveryV4Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/message-pickup/4.0/delivery')

  @IsString()
  @IsOptional()
  @Expose({ name: 'recipient_did' })
  public recipientDid?: string

  public toV2Plaintext(): DidCommV2PlaintextMessage {
    const v1 = this.toJSON() as Record<string, unknown>
    const attach = (v1['~attach'] as Array<Record<string, unknown>> | undefined) ?? []

    const body: Record<string, unknown> = {}
    if (this.recipientDid !== undefined) body.recipient_did = this.recipientDid

    const v2: DidCommV2PlaintextMessage = {
      id: this.id,
      type: DidCommMessageDeliveryV4Message.type.messageTypeUri,
      body,
      attachments: attach.map(mapV1AttachmentToV2),
    }
    if (this.thread?.threadId) v2.thid = this.thread.threadId
    return v2
  }
}
