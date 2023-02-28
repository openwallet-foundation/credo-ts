import type { MessageHandler, MessageHandlerInboundMessage } from '../../../agent/MessageHandler'
import type { DidRepository } from '../../dids/repository'
import type { OutOfBandService } from '../../oob/OutOfBandService'
import type { RoutingService } from '../../routing/services/RoutingService'
import type { ConnectionsModuleConfig } from '../ConnectionsModuleConfig'
import type { DidExchangeProtocol } from '../DidExchangeProtocol'

import { OutboundMessageContext } from '../../../agent/models'
import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { tryParseDid } from '../../dids/domain/parse'
import { OutOfBandState } from '../../oob/domain/OutOfBandState'
import { DidExchangeRequestMessage } from '../messages'
import { HandshakeProtocol } from '../models'

export class DidExchangeRequestHandler implements MessageHandler {
  private didExchangeProtocol: DidExchangeProtocol
  private outOfBandService: OutOfBandService
  private routingService: RoutingService
  private didRepository: DidRepository
  private connectionsModuleConfig: ConnectionsModuleConfig
  public supportedMessages = [DidExchangeRequestMessage]

  public constructor(
    didExchangeProtocol: DidExchangeProtocol,
    outOfBandService: OutOfBandService,
    routingService: RoutingService,
    didRepository: DidRepository,
    connectionsModuleConfig: ConnectionsModuleConfig
  ) {
    this.didExchangeProtocol = didExchangeProtocol
    this.outOfBandService = outOfBandService
    this.routingService = routingService
    this.didRepository = didRepository
    this.connectionsModuleConfig = connectionsModuleConfig
  }

  public async handle(messageContext: MessageHandlerInboundMessage<DidExchangeRequestHandler>) {
    const { agentContext, recipientKey, senderKey, message, connection } = messageContext

    if (!recipientKey || !senderKey) {
      throw new AriesFrameworkError('Unable to process connection request without senderKey or recipientKey')
    }

    const parentThreadId = message.thread?.parentThreadId

    if (!parentThreadId) {
      throw new AriesFrameworkError(`Message does not contain 'pthid' attribute`)
    }

    const outOfBandRecord = tryParseDid(parentThreadId)
      ? await this.outOfBandService.createFromImplicitInvitation(agentContext, {
          did: parentThreadId,
          threadId: message.threadId,
          recipientKey,
          handshakeProtocols: [HandshakeProtocol.DidExchange],
        })
      : await this.outOfBandService.findByCreatedInvitationId(agentContext, parentThreadId)
    if (!outOfBandRecord) {
      throw new AriesFrameworkError(`OutOfBand record for message ID ${parentThreadId} not found!`)
    }

    if (connection && !outOfBandRecord.reusable) {
      throw new AriesFrameworkError(
        `Connection record for non-reusable out-of-band ${outOfBandRecord.id} already exists.`
      )
    }

    const receivedDidRecord = await this.didRepository.findReceivedDidByRecipientKey(
      messageContext.agentContext,
      senderKey
    )
    if (receivedDidRecord) {
      throw new AriesFrameworkError(`A received did record for sender key ${senderKey.fingerprint} already exists.`)
    }

    // TODO Shouldn't we check also if the keys match the keys from oob invitation services?

    if (outOfBandRecord.state === OutOfBandState.Done) {
      throw new AriesFrameworkError(
        'Out-of-band record has been already processed and it does not accept any new requests'
      )
    }

    const connectionRecord = await this.didExchangeProtocol.processRequest(messageContext, outOfBandRecord)

    if (connectionRecord.autoAcceptConnection ?? this.connectionsModuleConfig.autoAcceptConnections) {
      // TODO We should add an option to not pass routing and therefore do not rotate keys and use the keys from the invitation
      // TODO: Allow rotation of keys used in the invitation for new ones not only when out-of-band is reusable
      const routing = outOfBandRecord.reusable
        ? await this.routingService.getRouting(messageContext.agentContext)
        : undefined

      const message = await this.didExchangeProtocol.createResponse(
        messageContext.agentContext,
        connectionRecord,
        outOfBandRecord,
        routing
      )
      return new OutboundMessageContext(message, {
        agentContext: messageContext.agentContext,
        connection: connectionRecord,
        outOfBand: outOfBandRecord,
      })
    }
  }
}
