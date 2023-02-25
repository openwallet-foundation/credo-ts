import type { MessageHandler, MessageHandlerInboundMessage } from '../../../agent/MessageHandler'
import type { OutOfBandService } from '../../oob/OutOfBandService'
import type { RoutingService } from '../../routing/services/RoutingService'
import type { ConnectionsModuleConfig } from '../ConnectionsModuleConfig'
import type { ConnectionService } from '../services/ConnectionService'

import { OutboundMessageContext } from '../../../agent/models'
import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { tryParseDid } from '../../dids/domain/parse'
import { DidRepository } from '../../dids/repository'
import { OutOfBandRole, OutOfBandState } from '../../oob/domain'
import { OutOfBandInvitation } from '../../oob/messages'
import { OutOfBandRecord } from '../../oob/repository'
import { ConnectionRequestMessage } from '../messages'
import { HandshakeProtocol } from '../models'

export class ConnectionRequestHandler implements MessageHandler {
  private connectionService: ConnectionService
  private outOfBandService: OutOfBandService
  private routingService: RoutingService
  private didRepository: DidRepository
  private connectionsModuleConfig: ConnectionsModuleConfig
  public supportedMessages = [ConnectionRequestMessage]

  public constructor(
    connectionService: ConnectionService,
    outOfBandService: OutOfBandService,
    routingService: RoutingService,
    didRepository: DidRepository,
    connectionsModuleConfig: ConnectionsModuleConfig
  ) {
    this.connectionService = connectionService
    this.outOfBandService = outOfBandService
    this.routingService = routingService
    this.didRepository = didRepository
    this.connectionsModuleConfig = connectionsModuleConfig
  }

  public async handle(messageContext: MessageHandlerInboundMessage<ConnectionRequestHandler>) {
    const { connection, recipientKey, senderKey, message } = messageContext

    if (!recipientKey || !senderKey) {
      throw new AriesFrameworkError('Unable to process connection request without senderVerkey or recipientKey')
    }

    const parentThreadId = message.thread?.parentThreadId

    const createOobRecord = async (did: string) => {
      // If it's a request related to an implicit invitation, make sure destination DID is present in our wallet
      const publicDid = tryParseDid(did)
      if (
        publicDid &&
        !(await messageContext.agentContext.dependencyManager
          .resolve(DidRepository)
          .findCreatedDid(messageContext.agentContext, publicDid.did))
      ) {
        throw new AriesFrameworkError(`Referenced public did ${did} not found.`)
      }

      const outOfBandInvitation = new OutOfBandInvitation({
        id: message.threadId,
        services: [did],
        handshakeProtocols: [HandshakeProtocol.Connections],
      })

      const outOfBandRecord = new OutOfBandRecord({
        role: OutOfBandRole.Sender,
        state: OutOfBandState.AwaitResponse,
        reusable: true,
        autoAcceptConnection: this.connectionsModuleConfig.autoAcceptConnections,
        isImplicitInvitation: true,
        outOfBandInvitation,
        tags: {
          recipientKeyFingerprints: [recipientKey.fingerprint],
        },
      })

      await this.outOfBandService.save(messageContext.agentContext, outOfBandRecord)
      this.outOfBandService.emitStateChangedEvent(messageContext.agentContext, outOfBandRecord, null)
      return outOfBandRecord
    }

    const outOfBandRecord =
      parentThreadId && tryParseDid(parentThreadId)
        ? await createOobRecord(parentThreadId)
        : await this.outOfBandService.findCreatedByRecipientKey(messageContext.agentContext, recipientKey)

    if (!outOfBandRecord) {
      throw new AriesFrameworkError(`Out-of-band record for recipient key ${recipientKey.fingerprint} was not found.`)
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

    const connectionRecord = await this.connectionService.processRequest(messageContext, outOfBandRecord)

    if (connectionRecord?.autoAcceptConnection ?? this.connectionsModuleConfig.autoAcceptConnections) {
      // TODO: Allow rotation of keys used in the invitation for new ones not only when out-of-band is reusable
      const routing = outOfBandRecord.reusable
        ? await this.routingService.getRouting(messageContext.agentContext)
        : undefined

      const { message } = await this.connectionService.createResponse(
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
