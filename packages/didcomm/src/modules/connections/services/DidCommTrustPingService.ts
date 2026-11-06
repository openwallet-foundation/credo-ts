import { EventEmitter, injectable } from '@credo-ts/core'
import { DidCommProblemReportError } from '../../../errors'
import type { DidCommInboundMessageContext } from '../../../models'
import { DidCommOutboundMessageContext, DidCommProblemReportReason } from '../../../models'
import type { DidCommVersion } from '../../../util/didcommVersion'
import { isDidCommV2EncryptedMessage } from '../../../util/didcommVersion'
import type { DidCommTrustPingReceivedEvent, TrustPingResponseReceivedEvent } from '../DidCommTrustPingEvents'
import { DidCommTrustPingEventTypes } from '../DidCommTrustPingEvents'
import type { DidCommTrustPingMessage } from '../messages'
import {
  DidCommTrustPingResponseMessage,
  DidCommTrustPingResponseV2Message,
  DidCommTrustPingV2Message,
} from '../messages'
import type { DidCommConnectionRecord } from '../repository'

@injectable()
export class DidCommTrustPingService {
  private eventEmitter: EventEmitter

  public constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter
  }

  public assertSupportedDidCommVersion(
    {
      message,
      encryptedMessage,
    }: DidCommInboundMessageContext<
      | DidCommTrustPingMessage
      | DidCommTrustPingV2Message
      | DidCommTrustPingResponseMessage
      | DidCommTrustPingResponseV2Message
    >,
    connection: DidCommConnectionRecord
  ): void {
    const versions: DidCommVersion[] = [connection.didcommVersion ?? 'v1']
    if (encryptedMessage) versions.push(isDidCommV2EncryptedMessage(encryptedMessage) ? 'v2' : 'v1')

    const unsupportedVersion = versions.find((version) => !message.supportedDidCommVersions.includes(version))
    if (unsupportedVersion) {
      throw new DidCommProblemReportError(
        `Error handling message ${message.id} with type ${message.type}. The message type is not supported over DIDComm ${unsupportedVersion}`,
        { problemCode: DidCommProblemReportReason.MessageParseFailure }
      )
    }
  }

  public processPing(
    { message, agentContext }: DidCommInboundMessageContext<DidCommTrustPingMessage | DidCommTrustPingV2Message>,
    connection: DidCommConnectionRecord
  ) {
    this.eventEmitter.emit<DidCommTrustPingReceivedEvent>(agentContext, {
      type: DidCommTrustPingEventTypes.DidCommTrustPingReceivedEvent,
      payload: {
        connectionRecord: connection,
        message: message,
      },
    })

    if (message.responseRequested) {
      const response =
        message instanceof DidCommTrustPingV2Message
          ? new DidCommTrustPingResponseV2Message({ threadId: message.threadId })
          : new DidCommTrustPingResponseMessage({ threadId: message.threadId })

      return new DidCommOutboundMessageContext(response, { agentContext, connection })
    }
  }

  public processPingResponse(
    inboundMessage: DidCommInboundMessageContext<DidCommTrustPingResponseMessage | DidCommTrustPingResponseV2Message>
  ) {
    const { agentContext, message } = inboundMessage

    const connection = inboundMessage.assertReadyConnection()
    this.assertSupportedDidCommVersion(inboundMessage, connection)

    this.eventEmitter.emit<TrustPingResponseReceivedEvent>(agentContext, {
      type: DidCommTrustPingEventTypes.DidCommTrustPingResponseReceivedEvent,
      payload: {
        connectionRecord: connection,
        message: message,
      },
    })
  }
}
