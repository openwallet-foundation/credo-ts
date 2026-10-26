import { Expose } from 'class-transformer'
import { IsBoolean } from 'class-validator'
import { DidCommMessage } from '../../../DidCommMessage'
import type { DidCommVersion } from '../../../util/didcommVersion'
import { IsValidMessageType, parseMessageType } from '../../../util/messageType'

export interface DidCommTrustPingV2MessageOptions {
  id?: string
  responseRequested?: boolean
}

/**
 * @see https://identity.foundation/didcomm-messaging/spec/v2.1/#trust-ping-protocol-20
 */
export class DidCommTrustPingV2Message extends DidCommMessage {
  public readonly supportedDidCommVersions: DidCommVersion[] = ['v2']

  public constructor(options: DidCommTrustPingV2MessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.responseRequested = options.responseRequested ?? true
    }
  }

  @IsValidMessageType(DidCommTrustPingV2Message.type)
  public readonly type = DidCommTrustPingV2Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/trust-ping/2.0/ping')

  @IsBoolean()
  @Expose({ name: 'response_requested' })
  public responseRequested = true
}
