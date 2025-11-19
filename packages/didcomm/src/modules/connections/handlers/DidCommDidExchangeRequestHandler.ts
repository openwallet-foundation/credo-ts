import type { DidRepository } from '@credo-ts/core'
import { CredoError, tryParseDid } from '@credo-ts/core'
import { DidCommTransportService } from '../../../DidCommTransportService'
import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import { DidCommOutboundMessageContext } from '../../../models'
import type { DidCommOutOfBandService } from '../../oob/DidCommOutOfBandService'
import { DidCommOutOfBandState } from '../../oob/domain/DidCommOutOfBandState'
import type { DidCommRoutingService } from '../../routing/services/DidCommRoutingService'
import type { DidCommConnectionsModuleConfig } from '../DidCommConnectionsModuleConfig'
import type { DidExchangeProtocol } from '../DidExchangeProtocol'
import { DidCommDidExchangeRequestMessage } from '../messages'
import { DidCommHandshakeProtocol } from '../models'

export class DidCommDidExchangeRequestHandler implements DidCommMessageHandler {
  private didExchangeProtocol: DidExchangeProtocol
  private outOfBandService: DidCommOutOfBandService
  private routingService: DidCommRoutingService
  private didRepository: DidRepository
  private connectionsModuleConfig: DidCommConnectionsModuleConfig
  public supportedMessages = [DidCommDidExchangeRequestMessage]

  public constructor(
    didExchangeProtocol: DidExchangeProtocol,
    outOfBandService: DidCommOutOfBandService,
    routingService: DidCommRoutingService,
    didRepository: DidRepository,
    connectionsModuleConfig: DidCommConnectionsModuleConfig
  ) {
    this.didExchangeProtocol = didExchangeProtocol
    this.outOfBandService = outOfBandService
    this.routingService = routingService
    this.didRepository = didRepository
    this.connectionsModuleConfig = connectionsModuleConfig
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommDidExchangeRequestHandler>) {
    const { agentContext, recipientKey, senderKey, message, connection, sessionId } = messageContext

    if (!recipientKey || !senderKey) {
      throw new CredoError('Unable to process connection request without senderKey or recipientKey')
    }

    const parentThreadId = message.thread?.parentThreadId

    if (!parentThreadId) {
      throw new CredoError(`Message does not contain 'pthid' attribute`)
    }

    const outOfBandRecord = tryParseDid(parentThreadId)
      ? await this.outOfBandService.createFromImplicitInvitation(agentContext, {
        did: parentThreadId,
        threadId: message.threadId,
        recipientKey,
        handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
      })
      : await this.outOfBandService.findByCreatedInvitationId(agentContext, parentThreadId)
    if (!outOfBandRecord) {
      throw new CredoError(`OutOfBand record for message ID ${parentThreadId} not found!`)
    }

    if (connection && !outOfBandRecord.reusable) {
      throw new CredoError(`Connection record for non-reusable out-of-band ${outOfBandRecord.id} already exists.`)
    }

    const receivedDidRecord = await this.didRepository.findReceivedDidByRecipientKey(agentContext, senderKey)
    if (receivedDidRecord) {
      throw new CredoError(`A received did record for sender key ${senderKey.fingerprint} already exists.`)
    }

    // TODO Shouldn't we check also if the keys match the keys from oob invitation services?

    if (outOfBandRecord.state === DidCommOutOfBandState.Done) {
      throw new CredoError('Out-of-band record has been already processed and it does not accept any new requests')
    }

    const connectionRecord = await this.didExchangeProtocol.processRequest(messageContext, outOfBandRecord)

    // Associate the new connection with the session created for the inbound message
    if (sessionId) {
      const transportService = agentContext.dependencyManager.resolve(DidCommTransportService)
      await transportService.setConnectionIdForSession(sessionId, connectionRecord.id)
    }

    if (!outOfBandRecord.reusable) {
      await this.outOfBandService.updateState(agentContext, outOfBandRecord, DidCommOutOfBandState.Done)
    }

    if (connectionRecord.autoAcceptConnection ?? this.connectionsModuleConfig.autoAcceptConnections) {
      // TODO We should add an option to not pass routing and therefore do not rotate keys and use the keys from the invitation
      // TODO: Allow rotation of keys used in the invitation for new ones not only when out-of-band is reusable

      // We generate routing in two scenarios:
      // 1. When the out-of-band invitation is reusable, as otherwise all connections use the same keys
      // 2. When the out-of-band invitation has no inline services, as we don't want to generate a legacy did doc from a service did
      const routing =
        outOfBandRecord.reusable || outOfBandRecord.outOfBandInvitation.getInlineServices().length === 0
          ? await this.routingService.getRouting(agentContext)
          : undefined

      const message = await this.didExchangeProtocol.createResponse(
        agentContext,
        connectionRecord,
        outOfBandRecord,
        routing
      )
      return new DidCommOutboundMessageContext(message, {
        agentContext,
        connection: connectionRecord,
        outOfBand: outOfBandRecord,
      })
    }
  }
}
