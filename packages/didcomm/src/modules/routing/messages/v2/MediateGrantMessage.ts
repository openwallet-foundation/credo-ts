import { Expose } from 'class-transformer'
import { IsNotEmpty, IsString } from 'class-validator'

import { DidCommMessage } from '../../../../DidCommMessage'
import { IsValidMessageType, parseMessageType } from '../../../../util/messageType'

export interface MediateGrantMessageOptions {
  id?: string
  routingDid: string
  threadId: string
}

/**
 * Mediate Grant 2.0 - signal from mediator to recipient with routing_did (DID-as-endpoint).
 *
 * @see https://didcomm.org/coordinate-mediation/2.0/
 */
export class MediateGrantMessage extends DidCommMessage {
  public readonly allowQueueTransport = false
  public readonly supportedDidCommVersions: ('v1' | 'v2')[] = ['v2']

  public constructor(options: MediateGrantMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.routingDid = options.routingDid
      this.setThread({ threadId: options.threadId })
    }
  }

  @IsValidMessageType(MediateGrantMessage.type)
  public readonly type = MediateGrantMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/coordinate-mediation/2.0/mediate-grant')

  @IsNotEmpty()
  @IsString()
  @Expose({ name: 'routing_did' })
  public routingDid!: string
}
