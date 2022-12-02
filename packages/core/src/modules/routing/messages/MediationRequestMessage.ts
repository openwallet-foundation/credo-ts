import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Expose, Type } from 'class-transformer'
import { IsOptional, IsString, ValidateNested } from 'class-validator'

import { DIDCommV1Message, DIDCommV2Message } from '../../../agent/didcomm'
import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'

export interface MediationRequestMessageOptions {
  sentTime?: Date
  id?: string
  locale?: string
}

/**
 * This message serves as a request from the recipient to the mediator, asking for the permission (and routing information)
 * to publish the endpoint as a mediator.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0211-route-coordination/README.md#mediation-request
 */
export class MediationRequestMessage extends DIDCommV1Message {
  /**
   * Create new BasicMessage instance.
   * sentTime will be assigned to new Date if not passed, id will be assigned to uuid/v4 if not passed
   * @param options
   */
  public constructor(options: MediationRequestMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.addLocale(options.locale || 'en')
    }
  }

  @IsValidMessageType(MediationRequestMessage.type)
  public readonly type = MediationRequestMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/coordinate-mediation/1.0/mediate-request')
}

export class MediationRequestMessageV2Body {
  @IsString()
  @IsOptional()
  @Expose({ name: 'delivery_type' })
  public deliveryType?: string

  @IsString()
  @IsOptional()
  @Expose({ name: 'delivery_data' })
  public deliveryData?: string
}

export type MediationRequestMessageV2Options = {
  body: MediationRequestMessageV2Body
} & DIDCommV2MessageParams

/**
 * This message serves as a request from the recipient to the mediator, asking for the permission (and routing information)
 * to publish the endpoint as a mediator.
 * DIDComm V2 version of message defined here https://github.com/hyperledger/aries-rfcs/blob/master/features/0211-route-coordination/README.md#mediation-request
 */
export class MediationRequestMessageV2 extends DIDCommV2Message {
  public constructor(options: MediationRequestMessageV2Options) {
    super(options)
  }

  @IsValidMessageType(MediationRequestMessageV2.type)
  public readonly type = MediationRequestMessageV2.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/coordinate-mediation/2.0/mediate-request')

  @Type(() => MediationRequestMessageV2Body)
  @ValidateNested()
  public body!: MediationRequestMessageV2Body
}
