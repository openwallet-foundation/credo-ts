import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { OutOfBandService } from '../../oob/OutOfBandService'
import type { MediationRecipientService } from '../../routing/services/MediationRecipientService'
import type { ConnectionService, Routing } from '../services/ConnectionService'

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

    let connectionRecord
    if (outOfBandRecord) {
      const oobRouting = await this.mediationRecipientService.getRouting()
      connectionRecord = await this.connectionService.protocolProcessRequest(
        messageContext,
        outOfBandRecord,
        oobRouting
      )
    } else {
      connectionRecord = await this.connectionService.findByVerkey(messageContext.recipientVerkey)
      if (!connectionRecord) {
        throw new AriesFrameworkError(
          `Neither connection nor out-of-band record for verkey ${messageContext.recipientVerkey} found!`
        )
      }

      let routing: Routing | undefined

      // routing object is required for multi use invitation, because we're creating a
      // new keypair that possibly needs to be registered at a mediator
      if (connectionRecord.multiUseInvitation) {
        routing = await this.mediationRecipientService.getRouting()
      }

      connectionRecord = await this.connectionService.processRequest(messageContext, routing)
    }

    if (connectionRecord?.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
      const { message } = await this.connectionService.createResponse(connectionRecord, outOfBandRecord || undefined)
      return createOutboundMessage(connectionRecord, message, outOfBandRecord || undefined)
    }
  }
}
