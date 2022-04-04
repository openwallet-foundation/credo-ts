import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DidRepository } from '../../dids/repository'
import type { OutOfBandService } from '../../oob/OutOfBandService'
import type { MediationRecipientService } from '../../routing/services/MediationRecipientService'
import type { DidExchangeProtocol } from '../DidExchangeProtocol'

import { createOutboundMessage } from '../../../agent/helpers'
import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { OutOfBandState } from '../../oob/domain/OutOfBandState'
import { DidExchangeRequestMessage } from '../messages'

export class DidExchangeRequestHandler implements Handler {
  private didExchangeProtocol: DidExchangeProtocol
  private outOfBandService: OutOfBandService
  private agentConfig: AgentConfig
  private mediationRecipientService: MediationRecipientService
  private didRepository: DidRepository
  public supportedMessages = [DidExchangeRequestMessage]

  public constructor(
    agentConfig: AgentConfig,
    didExchangeProtocol: DidExchangeProtocol,
    outOfBandService: OutOfBandService,
    mediationRecipientService: MediationRecipientService,
    didRepository: DidRepository
  ) {
    this.agentConfig = agentConfig
    this.didExchangeProtocol = didExchangeProtocol
    this.outOfBandService = outOfBandService
    this.mediationRecipientService = mediationRecipientService
    this.didRepository = didRepository
  }

  public async handle(messageContext: HandlerInboundMessage<DidExchangeRequestHandler>) {
    const { recipientVerkey, senderVerkey, message, connection } = messageContext

    if (!recipientVerkey || !senderVerkey) {
      throw new AriesFrameworkError('Unable to process connection request without senderVerkey or recipientVerkey')
    }

    if (!message.thread?.parentThreadId) {
      throw new AriesFrameworkError(`Message does not contain 'pthid' attribute`)
    }
    const outOfBandRecord = await this.outOfBandService.findByMessageId(message.thread.parentThreadId)

    if (!outOfBandRecord) {
      throw new AriesFrameworkError(`OutOfBand record for message ID ${message.thread?.parentThreadId} not found!`)
    }

    if (connection && !outOfBandRecord.reusable) {
      throw new AriesFrameworkError(
        `Connection record for non-reusable out-of-band ${outOfBandRecord.id} already exists.`
      )
    }

    const didRecord = await this.didRepository.findByVerkey(senderVerkey)
    if (didRecord) {
      throw new AriesFrameworkError(`Did record for sender key ${senderVerkey} already exists.`)
    }

    // TODO Shouln't we check also if the keys match the keys from oob invitation services?

    if (outOfBandRecord.state === OutOfBandState.Done) {
      throw new AriesFrameworkError(
        'Out-of-band record has been already processed and it does not accept any new requests'
      )
    }

    // TODO: Allow rotation of keys used in the invitation for new ones not only when out-of-band is reusable
    let routing
    if (outOfBandRecord.reusable) {
      routing = await this.mediationRecipientService.getRouting()
    }

    const connectionRecord = await this.didExchangeProtocol.processRequest(messageContext, outOfBandRecord, routing)

    if (connectionRecord?.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
      // TODO We should add an option to not pass routing and therefore do not rotate keys and use the keys from the invitation
      const message = await this.didExchangeProtocol.createResponse(connectionRecord, outOfBandRecord, routing)
      return createOutboundMessage(connectionRecord, message, outOfBandRecord)
    }
  }
}
