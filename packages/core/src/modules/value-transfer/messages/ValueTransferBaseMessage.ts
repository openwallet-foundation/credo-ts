import type { DIDCommV2MessageParams } from '../../../agent/didcomm'
import type { Attachment } from 'didcomm'

import { Receipt, ValueTransferDelta } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Type } from 'class-transformer'
import { IsInstance, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'
import { JsonTransformer } from '../../../utils'

export const VTP_RECEIPT_ATTACHMENT_ID = 'vtp-receipt'
export const VTP_DELTA_ATTACHMENT_ID = 'vtp-delta'
export const CUSTOM_ATTACHMENT_ID = 'custom-vtp-attachment'

export type ValueTransferMessageParams = DIDCommV2MessageParams

export class ValueTransferMessageBody {}

export class ValueTransferBaseMessage extends DIDCommV2Message {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @Type(() => ValueTransferMessageBody)
  @ValidateNested()
  @IsInstance(ValueTransferMessageBody)
  public body!: ValueTransferMessageBody

  public static createVtpReceiptJSONAttachment(message: Receipt): Attachment {
    return ValueTransferBaseMessage.createJSONAttachment(VTP_RECEIPT_ATTACHMENT_ID, JsonTransformer.toJSON(message))
  }

  public static createVtpDeltaJSONAttachment(message: ValueTransferDelta): Attachment {
    return ValueTransferBaseMessage.createJSONAttachment(VTP_DELTA_ATTACHMENT_ID, JsonTransformer.toJSON(message))
  }

  public static createCustomJSONAttachment(attachment: Record<string, unknown>): Attachment {
    return this.createJSONAttachment(CUSTOM_ATTACHMENT_ID, JsonTransformer.toJSON(attachment))
  }

  public get valueTransferMessage(): Receipt | undefined {
    return this.attachedMessage(VTP_RECEIPT_ATTACHMENT_ID, Receipt)
  }

  public get valueTransferDelta(): ValueTransferDelta | undefined {
    return this.attachedMessage(VTP_DELTA_ATTACHMENT_ID, ValueTransferDelta)
  }

  public get getCustomAttachment(): Record<string, unknown> | undefined {
    return this.getAttachmentDataAsJson(CUSTOM_ATTACHMENT_ID)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public attachedMessage<T>(id: string, Class: { new (...args: any[]): T }): T | undefined {
    // Extract value transfer message from attachment
    const attachment = this.getAttachmentDataAsJson(id)
    if (!attachment) return undefined
    return typeof attachment === 'string'
      ? JsonTransformer.deserialize(attachment, Class)
      : JsonTransformer.fromJSON(attachment, Class)
  }
}
