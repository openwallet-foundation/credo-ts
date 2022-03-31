import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { OutOfBandService } from '../../oob/OutOfBandService'
import type { MediationRecipientService } from '../../routing/services/MediationRecipientService'
import type { ConnectionService } from '../services/ConnectionService'

import { createOutboundMessage } from '../../../agent/helpers'
import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { ConnectionRequestMessage } from '../messages'

export class ConnectionRequestHandler implements Handler {
  private connectionService: ConnectionService
  private outOfBandService: OutOfBandService
  private agentConfig: AgentConfig
  private mediationRecipientService: MediationRecipientService
  public supportedMessages = [ConnectionRequestMessage]

  public constructor(
    connectionService: ConnectionService,
    outOfBandRepository: OutOfBandService,
    agentConfig: AgentConfig,
    mediationRecipientService: MediationRecipientService
  ) {
    this.connectionService = connectionService
    this.outOfBandService = outOfBandRepository
    this.agentConfig = agentConfig
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: HandlerInboundMessage<ConnectionRequestHandler>) {
    if (!messageContext.recipientVerkey || !messageContext.senderVerkey) {
      throw new AriesFrameworkError('Unable to process connection request without senderVerkey or recipientVerkey')
    }

    const { recipientVerkey } = messageContext
    const outOfBandRecord = await this.outOfBandService.findByRecipientKey(recipientVerkey)

    if (!outOfBandRecord) {
      throw new AriesFrameworkError(`Out-of-band record for recipientKey ${recipientVerkey} was not found.`)
    }

    // TODO: Allow rotation of keys used in the invitation for new ones not only when out-of-band is reusable
    let routing
    if (outOfBandRecord.reusable) {
      routing = await this.mediationRecipientService.getRouting()
    }
    const connectionRecord = await this.connectionService.processRequest(messageContext, outOfBandRecord, routing)

    if (connectionRecord?.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
      const { message } = await this.connectionService.createResponse(connectionRecord, outOfBandRecord, routing)
      return createOutboundMessage(connectionRecord, message, outOfBandRecord)
    }
  }
}
