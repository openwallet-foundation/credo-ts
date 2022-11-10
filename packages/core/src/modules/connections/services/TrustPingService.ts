import type { AgentContext } from '../../../agent'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { TrustPingMessage } from '../messages'
import type { ConnectionRecord } from '../repository/ConnectionRecord'

import { AgentConfig } from '../../../agent/AgentConfig'
import { createOutboundDIDCommV2Message, createOutboundDIDCommV1Message } from '../../../agent/helpers'
import { injectable } from '../../../plugins'
import { TrustPingResponseMessage } from '../messages'
import { TrustPingResponseMessageV2 } from '../messages/TrustPingResponseV2Message'
import { TrustPingMessageV2 } from '../messages/TrustPingV2Message'

@injectable()
export class TrustPingService {
  private agentConfig: AgentConfig

  public constructor(agentConfig: AgentConfig) {
    this.agentConfig = agentConfig
  }

  public processPing({ message }: InboundMessageContext<TrustPingMessage>, connection: ConnectionRecord) {
    if (message.responseRequested) {
      const response = new TrustPingResponseMessage({
        threadId: message.id,
      })

      return createOutboundDIDCommV1Message(connection, response)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public processPingResponse(inboundMessage: InboundMessageContext<TrustPingResponseMessage>) {
    // TODO: handle ping response message
  }

  public pingV2(agentContext: AgentContext, fromDid: string, toDid: string): TrustPingMessageV2 {
    this.agentConfig.logger.info(`Send Trust Ping message to DID ${toDid}.`)
    return new TrustPingMessageV2({
      from: fromDid,
      to: toDid,
      body: {
        responseRequested: true,
      },
    })
  }

  public processPingV2({ message }: InboundMessageContext<TrustPingMessageV2>) {
    this.agentConfig.logger.info('Trust Ping message received.', message)
    if (message.body.responseRequested) {
      const response = new TrustPingResponseMessageV2({
        from: message.to?.length ? message.to[0] : undefined,
        to: message.from,
        body: {},
        thid: message.id,
      })

      return createOutboundDIDCommV2Message(response)
    }
  }

  public processPingResponseV2({ message }: InboundMessageContext<TrustPingResponseMessageV2>) {
    this.agentConfig.logger.info('Trust Ping Response message received.', message)
  }
}
