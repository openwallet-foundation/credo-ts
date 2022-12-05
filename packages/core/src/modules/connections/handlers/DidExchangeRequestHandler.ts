import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DidRepository } from '../../dids/repository'
import type { OutOfBandService } from '../../oob/protocols/v1/OutOfBandService'
import type { MediationService } from '../../routing/services/MediationService'
import type { ConnectionsModuleConfig } from '../ConnectionsModuleConfig'
import type { DidExchangeProtocol } from '../DidExchangeProtocol'

import { OutboundMessageContext } from '../../../agent/models'
import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { OutOfBandState } from '../../oob/domain/OutOfBandState'
import { DidExchangeRequestMessage } from '../messages'

export class DidExchangeRequestHandler implements Handler {
  private didExchangeProtocol: DidExchangeProtocol
  private outOfBandService: OutOfBandService
  private mediationService: MediationService
  private didRepository: DidRepository
  private connectionsModuleConfig: ConnectionsModuleConfig
  public supportedMessages = [DidExchangeRequestMessage]

  public constructor(
    didExchangeProtocol: DidExchangeProtocol,
    outOfBandService: OutOfBandService,
    mediationService: MediationService,
    didRepository: DidRepository,
    connectionsModuleConfig: ConnectionsModuleConfig
  ) {
    this.didExchangeProtocol = didExchangeProtocol
    this.outOfBandService = outOfBandService
    this.mediationService = mediationService
    this.didRepository = didRepository
    this.connectionsModuleConfig = connectionsModuleConfig
  }

  public async handle(messageContext: HandlerInboundMessage<DidExchangeRequestHandler>) {
    const { recipientKey, senderKey, message, connection } = messageContext

    if (!recipientKey || !senderKey) {
      throw new AriesFrameworkError('Unable to process connection request without senderKey or recipientKey')
    }

    if (!message.thread?.parentThreadId) {
      throw new AriesFrameworkError(`Message does not contain 'pthid' attribute`)
    }
    const outOfBandRecord = await this.outOfBandService.findByInvitationId(
      messageContext.agentContext,
      message.thread.parentThreadId
    )

    if (!outOfBandRecord) {
      throw new AriesFrameworkError(`OutOfBand record for message ID ${message.thread?.parentThreadId} not found!`)
    }

    if (connection && !outOfBandRecord.reusable) {
      throw new AriesFrameworkError(
        `Connection record for non-reusable out-of-band ${outOfBandRecord.id} already exists.`
      )
    }

    const didRecord = await this.didRepository.findByRecipientKey(messageContext.agentContext, senderKey)
    if (didRecord) {
      throw new AriesFrameworkError(`Did record for sender key ${senderKey.fingerprint} already exists.`)
    }

    // TODO Shouldn't we check also if the keys match the keys from oob invitation services?

    if (outOfBandRecord.state === OutOfBandState.Done) {
      throw new AriesFrameworkError(
        'Out-of-band record has been already processed and it does not accept any new requests'
      )
    }

    const connectionRecord = await this.didExchangeProtocol.processRequest(messageContext, outOfBandRecord)

    if (connectionRecord.autoAcceptConnection ?? this.connectionsModuleConfig.autoAcceptConnections) {
      // TODO We should add an option to not pass routing and therefore do not rotate keys and use the keys from the invitation
      // TODO: Allow rotation of keys used in the invitation for new ones not only when out-of-band is reusable
      const routing = outOfBandRecord.reusable
        ? await this.mediationService.getRouting(messageContext.agentContext)
        : undefined

      const message = await this.didExchangeProtocol.createResponse(
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
