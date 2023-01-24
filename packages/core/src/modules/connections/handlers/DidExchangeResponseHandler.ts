import type { MessageHandler, MessageHandlerInboundMessage } from '../../../agent/MessageHandler'
import type { DidResolverService } from '../../dids'
import type { OutOfBandService } from '../../oob/OutOfBandService'
import type { ConnectionsModuleConfig } from '../ConnectionsModuleConfig'
import type { DidExchangeProtocol } from '../DidExchangeProtocol'
import type { ConnectionService } from '../services'

import { OutboundMessageContext } from '../../../agent/models'
import { ReturnRouteTypes } from '../../../decorators/transport/TransportDecorator'
import { AriesFrameworkError } from '../../../error'
import { OutOfBandState } from '../../oob/domain/OutOfBandState'
import { DidExchangeResponseMessage } from '../messages'
import { DidExchangeRole, HandshakeProtocol } from '../models'

export class DidExchangeResponseHandler implements MessageHandler {
  private didExchangeProtocol: DidExchangeProtocol
  private outOfBandService: OutOfBandService
  private connectionService: ConnectionService
  private didResolverService: DidResolverService
  private connectionsModuleConfig: ConnectionsModuleConfig
  public supportedMessages = [DidExchangeResponseMessage]

  public constructor(
    didExchangeProtocol: DidExchangeProtocol,
    outOfBandService: OutOfBandService,
    connectionService: ConnectionService,
    didResolverService: DidResolverService,
    connectionsModuleConfig: ConnectionsModuleConfig
  ) {
    this.didExchangeProtocol = didExchangeProtocol
    this.outOfBandService = outOfBandService
    this.connectionService = connectionService
    this.didResolverService = didResolverService
    this.connectionsModuleConfig = connectionsModuleConfig
  }

  public async handle(messageContext: MessageHandlerInboundMessage<DidExchangeResponseHandler>) {
    const { agentContext, recipientKey, senderKey, message } = messageContext

    if (!recipientKey || !senderKey) {
      throw new AriesFrameworkError('Unable to process connection response without sender key or recipient key')
    }

    const connectionRecord = await this.connectionService.getByRoleAndThreadId(
      agentContext,
      DidExchangeRole.Requester,
      message.threadId
    )
    if (!connectionRecord) {
      throw new AriesFrameworkError(`Connection for thread ID ${message.threadId} not found!`)
    }

    if (!connectionRecord.did) {
      throw new AriesFrameworkError(`Connection record ${connectionRecord.id} has no 'did'`)
    }

    const ourDidDocument = await this.didResolverService.resolveDidDocument(agentContext, connectionRecord.did)
    if (!ourDidDocument) {
      throw new AriesFrameworkError(`Did document for did ${connectionRecord.did} was not resolved`)
    }

    // Validate if recipient key is included in recipient keys of the did document resolved by
    // connection record did
    if (!ourDidDocument.recipientKeys.find((key) => key.fingerprint === recipientKey.fingerprint)) {
      throw new AriesFrameworkError(
        `Recipient key ${recipientKey.fingerprint} not found in did document recipient keys.`
      )
    }

    const { protocol } = connectionRecord
    if (protocol !== HandshakeProtocol.DidExchange) {
      throw new AriesFrameworkError(
        `Connection record protocol is ${protocol} but handler supports only ${HandshakeProtocol.DidExchange}.`
      )
    }

    if (!connectionRecord.outOfBandId) {
      throw new AriesFrameworkError(`Connection ${connectionRecord.id} does not have outOfBandId!`)
    }

    const outOfBandRecord = await this.outOfBandService.findById(agentContext, connectionRecord.outOfBandId)

    if (!outOfBandRecord) {
      throw new AriesFrameworkError(
        `OutOfBand record for connection ${connectionRecord.id} with outOfBandId ${connectionRecord.outOfBandId} not found!`
      )
    }

    // TODO
    //
    // A connection request message is the only case when I can use the connection record found
    // only based on recipient key without checking that `theirKey` is equal to sender key.
    //
    // The question is if we should do it here in this way or rather somewhere else to keep
    // responsibility of all handlers aligned.
    //
    messageContext.connection = connectionRecord
    const connection = await this.didExchangeProtocol.processResponse(messageContext, outOfBandRecord)

    // TODO: should we only send complete message in case of autoAcceptConnection or always?
    // In AATH we have a separate step to send the complete. So for now we'll only do it
    // if auto accept is enabled
    if (connection.autoAcceptConnection ?? this.connectionsModuleConfig.autoAcceptConnections) {
      const message = await this.didExchangeProtocol.createComplete(agentContext, connection, outOfBandRecord)
      // Disable return routing as we don't want to receive a response for this message over the same channel
      // This has led to long timeouts as not all clients actually close an http socket if there is no response message
      message.setReturnRouting(ReturnRouteTypes.none)

      if (!outOfBandRecord.reusable) {
        await this.outOfBandService.updateState(agentContext, outOfBandRecord, OutOfBandState.Done)
      }
      return new OutboundMessageContext(message, { agentContext, connection })
    }
  }
}
