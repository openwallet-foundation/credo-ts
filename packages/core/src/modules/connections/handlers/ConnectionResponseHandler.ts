import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DidResolverService } from '../../dids'
import type { OutOfBandService } from '../../oob/OutOfBandService'
import type { ConnectionService } from '../services/ConnectionService'

import { createOutboundMessage } from '../../../agent/helpers'
import { AriesFrameworkError } from '../../../error'
import { verkeyToDidKey } from '../../dids/helpers'
import { ConnectionResponseMessage } from '../messages'

export class ConnectionResponseHandler implements Handler {
  private agentConfig: AgentConfig
  private connectionService: ConnectionService
  private outOfBandService: OutOfBandService
  private didResolverService: DidResolverService

  public supportedMessages = [ConnectionResponseMessage]

  public constructor(
    agentConfig: AgentConfig,
    connectionService: ConnectionService,
    outOfBandService: OutOfBandService,
    didResolverService: DidResolverService
  ) {
    this.agentConfig = agentConfig
    this.connectionService = connectionService
    this.outOfBandService = outOfBandService
    this.didResolverService = didResolverService
  }

  public async handle(messageContext: HandlerInboundMessage<ConnectionResponseHandler>) {
    const { recipientVerkey, senderVerkey, message } = messageContext

    if (!recipientVerkey || !senderVerkey) {
      throw new AriesFrameworkError('Unable to process connection response without senderVerkey or recipientVerkey')
    }

    const connectionRecord = await this.connectionService.getByThreadId(message.threadId)
    if (!connectionRecord) {
      throw new AriesFrameworkError(`Connection for thread ID ${message.threadId} not found!`)
    }

    const ourDidDocument = await this.resolveDidDocument(connectionRecord.did)
    if (!ourDidDocument) {
      throw new AriesFrameworkError(`Did document for did ${connectionRecord.did} was not resolved!`)
    }

    // Validate if recipient key is included in recipient keys of the did document resolved by
    // connection record did
    if (!ourDidDocument.recipientKeys.map(verkeyToDidKey).includes(recipientVerkey)) {
      throw new AriesFrameworkError(`Recipient key ${recipientVerkey} not found in did document recipient keys.`)
    }

    const outOfBandRecord =
      connectionRecord.outOfBandId && (await this.outOfBandService.findById(connectionRecord.outOfBandId))

    if (!outOfBandRecord) {
      throw new AriesFrameworkError(`Out-of-band record ${connectionRecord.outOfBandId} was not found.`)
    }

    messageContext.connection = connectionRecord
    // The presence of outOfBandRecord is not mandatory when the old connection invitation is used
    const connection = await this.connectionService.processResponse(messageContext, outOfBandRecord)

    // TODO: should we only send ping message in case of autoAcceptConnection or always?
    // In AATH we have a separate step to send the ping. So for now we'll only do it
    // if auto accept is enable
    if (connection.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
      const { message } = await this.connectionService.createTrustPing(connection, { responseRequested: false })
      return createOutboundMessage(connection, message)
    }
  }

  private async resolveDidDocument(did: string) {
    const {
      didDocument,
      didResolutionMetadata: { error, message },
    } = await this.didResolverService.resolve(did)

    if (!didDocument) {
      throw new AriesFrameworkError(`Unable to resolve did document for did '${did}': ${error} ${message}`)
    }
    return didDocument
  }
}
