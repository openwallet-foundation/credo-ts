import { Expose, Type } from 'class-transformer'
import { IsInstance, IsOptional, IsString } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

export interface DidCommFeaturesDiscloseProtocolOptions {
  protocolId: string
  roles?: string[]
}

export class DidCommFeaturesDiscloseProtocol {
  public constructor(options: DidCommFeaturesDiscloseProtocolOptions) {
    if (options) {
      this.protocolId = options.protocolId
      this.roles = options.roles
    }
  }

  @Expose({ name: 'pid' })
  @IsString()
  public protocolId!: string

  @IsString({ each: true })
  @IsOptional()
  public roles?: string[]
}

export interface DidCommFeaturesDiscloseMessageOptions {
  id?: string
  threadId: string
  protocols: DidCommFeaturesDiscloseProtocolOptions[]
}

export class DidCommFeaturesDiscloseMessage extends DidCommMessage {
  public constructor(options: DidCommFeaturesDiscloseMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.protocols = options.protocols.map((p) => new DidCommFeaturesDiscloseProtocol(p))
      this.setThread({
        threadId: options.threadId,
      })
    }
  }

  @IsValidMessageType(DidCommFeaturesDiscloseMessage.type)
  public readonly type = DidCommFeaturesDiscloseMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/discover-features/1.0/disclose')

  @IsInstance(DidCommFeaturesDiscloseProtocol, { each: true })
  @Type(() => DidCommFeaturesDiscloseProtocol)
  public protocols!: DidCommFeaturesDiscloseProtocol[]
}
