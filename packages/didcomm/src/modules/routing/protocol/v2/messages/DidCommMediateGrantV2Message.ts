import { Expose } from 'class-transformer'
import { IsNotEmpty, IsString } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'
import type { DidCommVersion } from '../../../../../util/didcommVersion'

export interface DidCommMediateGrantV2MessageOptions {
  id?: string
  routingDid: string
  threadId: string
}

/**
 * Mediate Grant 2.0 - signal from mediator to recipient with routing_did (DID-as-endpoint).
 *
 * @see https://didcomm.org/coordinate-mediation/2.0/
 */
export class DidCommMediateGrantV2Message extends DidCommMessage {
  public readonly allowQueueTransport = false
  public readonly supportedDidCommVersions: DidCommVersion[] = ['v2']

  public constructor(options: DidCommMediateGrantV2MessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.routingDid = options.routingDid
      this.setThread({ threadId: options.threadId })
    }
  }

  @IsValidMessageType(DidCommMediateGrantV2Message.type)
  public readonly type = DidCommMediateGrantV2Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/coordinate-mediation/2.0/mediate-grant')

  @IsNotEmpty()
  @IsString()
  @Expose({ name: 'routing_did' })
  public routingDid!: string
}
