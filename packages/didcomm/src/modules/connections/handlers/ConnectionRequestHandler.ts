import type { DidRepository } from '@credo-ts/core'
import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidCommOutOfBandService } from '../../oob/DidCommOutOfBandService'
import type { DidCommRoutingService } from '../../routing/services/DidCommRoutingService'
import type { DidCommConnectionsModuleConfig } from '../DidCommConnectionsModuleConfig'
import type { DidCommConnectionService } from '../services'

import { CredoError, tryParseDid } from '@credo-ts/core'

import { DidCommTransportService } from '../../../DidCommTransportService'
import { OutboundDidCommMessageContext } from '../../../models'
import { DidCommOutOfBandState } from '../../oob/domain/DidCommOutOfBandState'
import { ConnectionRequestMessage } from '../messages'
import { DidCommHandshakeProtocol } from '../models'

export class ConnectionRequestHandler implements DidCommMessageHandler {
  private connectionService: DidCommConnectionService
  private outOfBandService: DidCommOutOfBandService
  private routingService: DidCommRoutingService
  private didRepository: DidRepository
  private connectionsModuleConfig: DidCommConnectionsModuleConfig
  public supportedMessages = [ConnectionRequestMessage]

  public constructor(
    connectionService: DidCommConnectionService,
    outOfBandService: DidCommOutOfBandService,
    routingService: DidCommRoutingService,
    didRepository: DidRepository,
    connectionsModuleConfig: DidCommConnectionsModuleConfig
  ) {
    this.connectionService = connectionService
    this.outOfBandService = outOfBandService
    this.routingService = routingService
    this.didRepository = didRepository
    this.connectionsModuleConfig = connectionsModuleConfig
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<ConnectionRequestHandler>) {
    const { agentContext, connection, recipientKey, senderKey, message, sessionId } = messageContext

    if (!recipientKey || !senderKey) {
      throw new CredoError('Unable to process connection request without senderVerkey or recipientKey')
    }

    const parentThreadId = message.thread?.parentThreadId

    const outOfBandRecord =
      parentThreadId && tryParseDid(parentThreadId)
        ? await this.outOfBandService.createFromImplicitInvitation(agentContext, {
            did: parentThreadId,
            threadId: message.threadId,
            recipientKey,
            handshakeProtocols: [DidCommHandshakeProtocol.Connections],
          })
        : await this.outOfBandService.findCreatedByRecipientKey(agentContext, recipientKey)

    if (!outOfBandRecord) {
      throw new CredoError(`Out-of-band record for recipient key ${recipientKey.fingerprint} was not found.`)
    }

    if (connection && !outOfBandRecord.reusable) {
      throw new CredoError(`Connection record for non-reusable out-of-band ${outOfBandRecord.id} already exists.`)
    }

    const receivedDidRecord = await this.didRepository.findReceivedDidByRecipientKey(agentContext, senderKey)
    if (receivedDidRecord) {
      throw new CredoError(`A received did record for sender key ${senderKey.fingerprint} already exists.`)
    }

    if (outOfBandRecord.state === DidCommOutOfBandState.Done) {
      throw new CredoError('Out-of-band record has been already processed and it does not accept any new requests')
    }

    const connectionRecord = await this.connectionService.processRequest(messageContext, outOfBandRecord)

    // Associate the new connection with the session created for the inbound message
    if (sessionId) {
      const transportService = agentContext.dependencyManager.resolve(DidCommTransportService)
      transportService.setConnectionIdForSession(sessionId, connectionRecord.id)
    }

    if (!outOfBandRecord.reusable) {
      await this.outOfBandService.updateState(agentContext, outOfBandRecord, DidCommOutOfBandState.Done)
    }

    if (connectionRecord?.autoAcceptConnection ?? this.connectionsModuleConfig.autoAcceptConnections) {
      // TODO: Allow rotation of keys used in the invitation for new ones not only when out-of-band is reusable or
      // when there are no inline services in the invitation

      // We generate routing in two scenarios:
      // 1. When the out-of-band invitation is reusable, as otherwise all connections use the same keys
      // 2. When the out-of-band invitation has no inline services, as we don't want to generate a legacy did doc from a service did
      const routing =
        outOfBandRecord.reusable || outOfBandRecord.outOfBandInvitation.getInlineServices().length === 0
          ? await this.routingService.getRouting(agentContext)
          : undefined

      const { message } = await this.connectionService.createResponse(
        agentContext,
        connectionRecord,
        outOfBandRecord,
        routing
      )
      return new OutboundDidCommMessageContext(message, {
        agentContext,
        connection: connectionRecord,
        outOfBand: outOfBandRecord,
      })
    }
  }
}
