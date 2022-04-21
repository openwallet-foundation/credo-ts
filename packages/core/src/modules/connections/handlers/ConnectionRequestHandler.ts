import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DidRepository } from '../../dids/repository'
import type { OutOfBandService } from '../../oob/OutOfBandService'
import type { MediationRecipientService } from '../../routing/services/MediationRecipientService'
import type { ConnectionService } from '../services/ConnectionService'

import { createOutboundMessage } from '../../../agent/helpers'
import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { DidKey } from '../../dids'
import { ConnectionRequestMessage } from '../messages'

export class ConnectionRequestHandler implements Handler {
  private agentConfig: AgentConfig
  private connectionService: ConnectionService
  private outOfBandService: OutOfBandService
  private mediationRecipientService: MediationRecipientService
  private didRepository: DidRepository
  public supportedMessages = [ConnectionRequestMessage]

  public constructor(
    agentConfig: AgentConfig,
    connectionService: ConnectionService,
    outOfBandService: OutOfBandService,
    mediationRecipientService: MediationRecipientService,
    didRepository: DidRepository
  ) {
    this.agentConfig = agentConfig
    this.connectionService = connectionService
    this.outOfBandService = outOfBandService
    this.mediationRecipientService = mediationRecipientService
    this.didRepository = didRepository
  }

  public async handle(messageContext: HandlerInboundMessage<ConnectionRequestHandler>) {
    const { connection, recipientKey, senderKey } = messageContext

    if (!recipientKey || !senderKey) {
      throw new AriesFrameworkError('Unable to process connection request without senderVerkey or recipientKey')
    }

    const recipientDidKey = new DidKey(recipientKey)
    const outOfBandRecord = await this.outOfBandService.findByRecipientKey(recipientDidKey.did)

    if (!outOfBandRecord) {
      throw new AriesFrameworkError(`Out-of-band record for recipient key ${recipientDidKey.did} was not found.`)
    }

    if (connection && !outOfBandRecord.reusable) {
      throw new AriesFrameworkError(
        `Connection record for non-reusable out-of-band ${outOfBandRecord.id} already exists.`
      )
    }

    const senderDidKey = new DidKey(senderKey)
    const didRecord = await this.didRepository.findByRecipientKey(senderDidKey.did)
    if (didRecord) {
      throw new AriesFrameworkError(`Did record for sender key ${senderDidKey.did} already exists.`)
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
