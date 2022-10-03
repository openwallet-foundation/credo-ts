import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DidRepository } from '../../dids/repository'
import type { OutOfBandServiceV2 } from '../../oob/OutOfBandServiceV2'
import type { RoutingService } from '../../routing/services/RoutingService'
import type { ConnectionService } from '../services/ConnectionService'

import { createOutboundMessage } from '../../../agent/helpers'
import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { ConnectionRequestMessage } from '../messages'

export class ConnectionRequestHandler implements Handler {
  private agentConfig: AgentConfig
  private connectionService: ConnectionService
  private outOfBandService: OutOfBandServiceV2
  private routingService: RoutingService
  private didRepository: DidRepository
  public supportedMessages = [ConnectionRequestMessage]

  public constructor(
    agentConfig: AgentConfig,
    connectionService: ConnectionService,
    outOfBandService: OutOfBandServiceV2,
    routingService: RoutingService,
    didRepository: DidRepository
  ) {
    this.agentConfig = agentConfig
    this.connectionService = connectionService
    this.outOfBandService = outOfBandService
    this.routingService = routingService
    this.didRepository = didRepository
  }

  public async handle(messageContext: HandlerInboundMessage<ConnectionRequestHandler>) {
    const { connection, recipient, sender } = messageContext

    if (!recipient || !sender) {
      throw new AriesFrameworkError('Unable to process connection request without senderVerkey or recipientKey')
    }

    const outOfBandRecord = await this.outOfBandService.findByRecipientKey(recipient)

    if (!outOfBandRecord) {
      throw new AriesFrameworkError(`Out-of-band record for recipient key ${recipient} was not found.`)
    }

    if (connection && !outOfBandRecord.reusable) {
      throw new AriesFrameworkError(
        `Connection record for non-reusable out-of-band ${outOfBandRecord.id} already exists.`
      )
    }

    const didRecord = await this.didRepository.findByRecipientKey(sender)
    if (didRecord) {
      throw new AriesFrameworkError(`Did record for sender key ${sender} already exists.`)
    }

    const connectionRecord = await this.connectionService.processRequest(messageContext, outOfBandRecord)

    if (connectionRecord?.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
      // TODO: Allow rotation of keys used in the invitation for new ones not only when out-of-band is reusable
      const routing = outOfBandRecord.reusable ? await this.routingService.getRouting() : undefined

      const { message } = await this.connectionService.createResponse(connectionRecord, outOfBandRecord, routing)
      return createOutboundMessage(connectionRecord, message, outOfBandRecord)
    }
  }
}
