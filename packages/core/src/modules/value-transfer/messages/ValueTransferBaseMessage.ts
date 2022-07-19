import type { DIDCommV2MessageParams } from '../../../agent/didcomm'
import type { Attachment } from 'didcomm'

import { Receipt, ValueTransferDelta } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Type } from 'class-transformer'
import { IsInstance, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'
import { JsonTransformer } from '../../../utils'

export const VALUE_TRANSFER_ATTACHMENT_ID = 'vtp'

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

  public static createValueTransferBase64Attachment(message: ValueTransferDelta | Receipt): Attachment {
    return ValueTransferBaseMessage.createBase64Attachment(
      VALUE_TRANSFER_ATTACHMENT_ID,
      JsonTransformer.serialize(message)
    )
  }

  public static createValueTransferJSONAttachment(message: ValueTransferDelta | Receipt): Attachment {
    return ValueTransferBaseMessage.createJSONAttachment(VALUE_TRANSFER_ATTACHMENT_ID, JsonTransformer.toJSON(message))
  }

  public get valueTransferMessage(): Receipt | null {
    return this.attachedMessage(Receipt)
  }

  public get valueTransferDelta(): ValueTransferDelta | null {
    return this.attachedMessage(ValueTransferDelta)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public attachedMessage<T>(Class: { new (...args: any[]): T }): T | null {
    // Extract value transfer message from attachment
    const attachment = this.getAttachmentDataAsJson(VALUE_TRANSFER_ATTACHMENT_ID)
    if (!attachment) return null
    return typeof attachment === 'string'
      ? JsonTransformer.deserialize(attachment, Class)
      : JsonTransformer.fromJSON(attachment, Class)
  }
}
