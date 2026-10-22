import { DidCommMessage } from '../../../DidCommMessage'
import type { DidCommVersion } from '../../../util/didcommVersion'
import { IsValidMessageType, parseMessageType } from '../../../util/messageType'

export interface DidCommTrustPingResponseV2MessageOptions {
  id?: string
  threadId: string
}

/**
 * @see https://identity.foundation/didcomm-messaging/spec/v2.1/#trust-ping-protocol-20
 */
export class DidCommTrustPingResponseV2Message extends DidCommMessage {
  public readonly supportedDidCommVersions: DidCommVersion[] = ['v2']

  public constructor(options: DidCommTrustPingResponseV2MessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()

      this.setThread({
        threadId: options.threadId,
      })
    }
  }

  @IsValidMessageType(DidCommTrustPingResponseV2Message.type)
  public readonly type = DidCommTrustPingResponseV2Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/trust-ping/2.0/ping-response')
}
