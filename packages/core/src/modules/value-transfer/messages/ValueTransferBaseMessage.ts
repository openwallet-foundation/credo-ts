import type { DIDCommV2MessageParams } from '../../../agent/didcomm'
import type { Attachment } from 'didcomm'

import { ValueTransferDelta, ValueTransferMessage } from '@sicpa-dlab/value-transfer-protocol-ts'
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

  public static createValueTransferBase64Attachment(message: ValueTransferDelta | ValueTransferMessage): Attachment {
    return ValueTransferBaseMessage.createBase64Attachment(
      VALUE_TRANSFER_ATTACHMENT_ID,
      JsonTransformer.serialize(message)
    )
  }

  public static createValueTransferJSONAttachment(message: ValueTransferDelta | ValueTransferMessage): Attachment {
    return ValueTransferBaseMessage.createJSONAttachment(
      VALUE_TRANSFER_ATTACHMENT_ID,
      JsonTransformer.serialize(message)
    )
  }

  public get valueTransferMessage(): ValueTransferMessage | null {
    // Extract value transfer message from attachment
    const attachment = this.getAttachmentDataAsJson(VALUE_TRANSFER_ATTACHMENT_ID)
    if (!attachment) return null
    return JsonTransformer.deserialize(attachment, ValueTransferMessage)
  }

  public get valueTransferDelta(): ValueTransferDelta | null {
    // Extract value transfer message from attachment
    const attachment = this.getAttachmentDataAsJson(VALUE_TRANSFER_ATTACHMENT_ID)
    if (!attachment) return null
    return JsonTransformer.deserialize(attachment, ValueTransferDelta)
  }
}
