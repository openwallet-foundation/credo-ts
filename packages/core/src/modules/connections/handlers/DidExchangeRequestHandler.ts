import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { OutOfBandRepository } from '../../oob/repository'
import type { MediationRecipientService } from '../../routing/services/MediationRecipientService'
import type { DidExchangeProtocol } from '../DidExchangeProtocol'

import { createOutboundMessage } from '../../../agent/helpers'
import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { DidExchangeRequestMessage } from '../messages'

export class DidExchangeRequestHandler implements Handler {
  private didExchangeProtocol: DidExchangeProtocol
  private outOfBandRepository: OutOfBandRepository
  private agentConfig: AgentConfig
  private mediationRecipientService: MediationRecipientService
  public supportedMessages = [DidExchangeRequestMessage]

  public constructor(
    didExchangeProtocol: DidExchangeProtocol,
    outOfBandRepository: OutOfBandRepository,
    agentConfig: AgentConfig,
    mediationRecipientService: MediationRecipientService
  ) {
    this.didExchangeProtocol = didExchangeProtocol
    this.outOfBandRepository = outOfBandRepository
    this.agentConfig = agentConfig
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: HandlerInboundMessage<DidExchangeRequestHandler>) {
    if (!messageContext.recipientVerkey || !messageContext.senderVerkey) {
      throw new AriesFrameworkError('Unable to process connection request without senderVerkey or recipientVerkey')
    }

    const { message } = messageContext
    const outOfBandRecord = await this.outOfBandRepository.findSingleByQuery({
      messageId: message.thread?.parentThreadId,
    })

    if (!outOfBandRecord) {
      throw new AriesFrameworkError(`OutOfBand record for message ID ${message.thread?.parentThreadId} not found!`)
    }

    // TODO Shouln't we check also if the keys match the keys from oob invitation services?

    // TODO Rotate keys or reuse the keys from oob invitation according to a config flag or method param.
    const routing = await this.mediationRecipientService.getRouting()

    const connectionRecord = await this.didExchangeProtocol.processRequest(messageContext, outOfBandRecord, routing)

    if (connectionRecord?.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
      // TODO We should add an option to not pass routing and therefore do not rotate keys and use the keys from the invitation
      const message = await this.didExchangeProtocol.createResponse(connectionRecord, outOfBandRecord, routing)
      return createOutboundMessage(connectionRecord, message)
    }
  }
}
