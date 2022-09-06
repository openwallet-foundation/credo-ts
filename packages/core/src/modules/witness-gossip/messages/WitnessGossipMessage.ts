import type { DIDCommV2MessageParams } from '../../../agent/didcomm'
import type { Attachment } from 'didcomm'

import { TransactionUpdate } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Type } from 'class-transformer'
import { Equals, IsArray, IsInstance, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'
import { JsonTransformer } from '../../../utils'

export const TRANSACTION_UPDATES_MEDIA_TYPE = 'application/wgp-tu'

export type WitnessGossipMessageBodyParams = {
  tell?: TellItem
  ask?: AskItem
  wids?: number
}

export type WitnessGossipMessageParams = {
  body: WitnessGossipMessageBody
} & DIDCommV2MessageParams

export class TellItem {
  @IsString()
  public id!: string
}

export class AskItem {
  @IsNumber()
  public since!: number
}

// FIXME: Just for simplicity `tell` and `ask` fields are NOT arrays as in specification. Change it in future
export class WitnessGossipMessageBody {
  @Type(() => TellItem)
  @IsOptional()
  public tell?: TellItem

  @Type(() => AskItem)
  @IsOptional()
  public ask?: AskItem

  @IsNumber()
  @IsOptional()
  public wids?: number

  public constructor(options?: WitnessGossipMessageBodyParams) {
    if (options) {
      this.tell = options.tell
      this.ask = options.ask
      this.wids = options.wids
    }
  }
}

export type TransactionUpdatesAttachmentParams = {
  transactionUpdates: Array<TransactionUpdate>
}

export class TransactionUpdatesAttachment {
  @Type(() => TransactionUpdate)
  @IsArray()
  public transactionUpdates!: Array<TransactionUpdate>

  public constructor(options?: TransactionUpdatesAttachmentParams) {
    if (options) {
      this.transactionUpdates = options.transactionUpdates
    }
  }
}

export class WitnessGossipMessage extends DIDCommV2Message {
  @Equals(WitnessGossipMessage.type)
  public readonly type = WitnessGossipMessage.type
  public static readonly type = 'https://didcomm.org/wgp/1.0/info'

  @Type(() => WitnessGossipMessageBody)
  @ValidateNested()
  @IsInstance(WitnessGossipMessageBody)
  public body!: WitnessGossipMessageBody

  public constructor(options?: WitnessGossipMessageParams) {
    super(options)
  }

  public static createTransactionUpdateJSONAttachment(
    wid: string,
    transactionUpdates: TransactionUpdate[]
  ): Attachment {
    const attachedMessage = new TransactionUpdatesAttachment({ transactionUpdates })
    const attachment = WitnessGossipMessage.createJSONAttachment(wid, JsonTransformer.toJSON(attachedMessage))
    attachment.media_type = TRANSACTION_UPDATES_MEDIA_TYPE
    return attachment
  }

  public transactionUpdates(wid: string): TransactionUpdate[] | undefined {
    const id = wid
    const attachedMessage = this.attachedMessage(id, TransactionUpdatesAttachment)
    return attachedMessage?.transactionUpdates
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
