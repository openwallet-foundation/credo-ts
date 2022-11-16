import type { TransactionUpdate } from '@sicpa-dlab/witness-gossip-types-ts'

import { ErrorCodes, ValueTransferError } from '@sicpa-dlab/value-transfer-common-ts'
import {
  GossipAttachment,
  WitnessGossipInfo,
  WitnessGossipInfoBody,
  WitnessMessageType,
} from '@sicpa-dlab/witness-gossip-types-ts'
import { Type } from 'class-transformer'
import { IsOptional, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'
import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'

export class WitnessGossipInfoMessage extends DIDCommV2Message implements WitnessGossipInfo {
  @IsValidMessageType(WitnessGossipInfoMessage.type)
  public readonly type: WitnessMessageType = WitnessGossipInfoMessage.type.messageTypeUri as WitnessMessageType
  public static readonly type = parseMessageType(WitnessGossipInfo.type)

  @IsString()
  public from!: string

  @Type(() => WitnessGossipInfoBody)
  @ValidateNested()
  public body!: WitnessGossipInfoBody

  @Type(() => GossipAttachment)
  @IsOptional()
  public attachments?: Array<GossipAttachment>

  public constructor(params?: WitnessGossipInfo) {
    super({ ...params })
  }

  public getAttachment(id: string): Array<TransactionUpdate> {
    const attachment = this.attachments?.find((attachment) => attachment.id === id)
    if (!attachment) {
      throw new ValueTransferError(
        ErrorCodes.InternalError,
        `Unable to process Witness Gossip Info: Attachment not found for id: ${id}`
      )
    }
    return attachment.data.json
  }
}
