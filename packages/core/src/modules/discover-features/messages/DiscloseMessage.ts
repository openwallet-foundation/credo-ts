import { Expose, Type } from 'class-transformer'
import { IsInstance, IsOptional, IsString } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'
import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'

export interface DiscloseProtocolOptions {
  protocolId: string
  roles?: string[]
}

export class DiscloseProtocol {
  public constructor(options: DiscloseProtocolOptions) {
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

export interface DiscoverFeaturesDiscloseMessageOptions {
  id?: string
  threadId: string
  protocols: DiscloseProtocolOptions[]
}

export class DiscloseMessage extends AgentMessage {
  public constructor(options: DiscoverFeaturesDiscloseMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.protocols = options.protocols.map((p) => new DiscloseProtocol(p))
      this.setThread({
        threadId: options.threadId,
      })
    }
  }

  @IsValidMessageType(DiscloseMessage.type)
  public readonly type = DiscloseMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/discover-features/1.0/disclose')

  @IsInstance(DiscloseProtocol, { each: true })
  @Type(() => DiscloseProtocol)
  public protocols!: DiscloseProtocol[]
}
