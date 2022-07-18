import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DidCommDocumentService } from '../../didcomm'
import type { DidResolverService } from '../../dids'
import type { OutOfBandService } from '../../oob/OutOfBandService'
import type { ConnectionService } from '../services/ConnectionService'

import { createOutboundMessage } from '../../../agent/helpers'
import { ReturnRouteTypes } from '../../../decorators/transport/TransportDecorator'
import { AriesFrameworkError } from '../../../error'
import { ConnectionResponseMessage } from '../messages'

export class ConnectionResponseHandler implements Handler {
  private agentConfig: AgentConfig
  private connectionService: ConnectionService
  private outOfBandService: OutOfBandService
  private didResolverService: DidResolverService
  private didCommDocumentService: DidCommDocumentService

  public supportedMessages = [ConnectionResponseMessage]

  public constructor(
    agentConfig: AgentConfig,
    connectionService: ConnectionService,
    outOfBandService: OutOfBandService,
    didResolverService: DidResolverService,
    didCommDocumentService: DidCommDocumentService
  ) {
    this.agentConfig = agentConfig
    this.connectionService = connectionService
    this.outOfBandService = outOfBandService
    this.didResolverService = didResolverService
    this.didCommDocumentService = didCommDocumentService
  }

  public async handle(messageContext: HandlerInboundMessage<ConnectionResponseHandler>) {
    const { recipientKey, senderKey, message } = messageContext

    if (!recipientKey || !senderKey) {
      throw new AriesFrameworkError('Unable to process connection response without senderKey or recipientKey')
    }

    const connectionRecord = await this.connectionService.getByThreadId(message.threadId)
    if (!connectionRecord) {
      throw new AriesFrameworkError(`Connection for thread ID ${message.threadId} not found!`)
    }

    if (!connectionRecord.did) {
      throw new AriesFrameworkError(`Connection record ${connectionRecord.id} has no 'did'`)
    }

    const ourDidDocument = await this.didResolverService.resolveDidDocument(connectionRecord.did)
    if (!ourDidDocument) {
      throw new AriesFrameworkError(`Did document for did ${connectionRecord.did} was not resolved!`)
    }

    // Validate if recipient key is included in recipient keys of the did document resolved by
    // connection record did
    if (!ourDidDocument.recipientKeys.find((key) => key.fingerprint === recipientKey.fingerprint)) {
      throw new AriesFrameworkError(
        `Recipient key ${recipientKey.fingerprint} not found in did document recipient keys.`
      )
    }

    const outOfBandRecord =
      connectionRecord.outOfBandId && (await this.outOfBandService.findById(connectionRecord.outOfBandId))

    if (!outOfBandRecord) {
      throw new AriesFrameworkError(`Out-of-band record ${connectionRecord.outOfBandId} was not found.`)
    }

    messageContext.connection = connectionRecord
    const connection = await this.connectionService.processResponse(messageContext, outOfBandRecord)

    // TODO: should we only send ping message in case of autoAcceptConnection or always?
    // In AATH we have a separate step to send the ping. So for now we'll only do it
    // if auto accept is enable
    if (connection.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
      const { message } = await this.connectionService.createTrustPing(connection, { responseRequested: false })

      // Disable return routing as we don't want to receive a response for this message over the same channel
      // This has led to long timeouts as not all clients actually close an http socket if there is no response message
      message.setReturnRouting(ReturnRouteTypes.none)
      return createOutboundMessage(connection, message)
    }
  }
}
