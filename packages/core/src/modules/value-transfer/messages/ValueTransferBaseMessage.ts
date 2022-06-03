import type { DIDCommV2MessageParams } from '../../../agent/didcomm'
import type { Attachment } from 'didcomm'

import { ValueTransferMessage } from '@sicpa-dlab/value-transfer-protocol-ts'
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

  public static createValueTransferBase64Attachment(message: ValueTransferMessage): Attachment {
    return ValueTransferBaseMessage.createBase64Attachment(VALUE_TRANSFER_ATTACHMENT_ID, message)
  }

  public get valueTransferMessage(): ValueTransferMessage | null {
    // Extract value transfer message from attachment
    const valueTransferMessage = this.getAttachmentDataAsJson(VALUE_TRANSFER_ATTACHMENT_ID)
    if (!valueTransferMessage) return null
    return JsonTransformer.fromJSON(valueTransferMessage, ValueTransferMessage)
  }
}
