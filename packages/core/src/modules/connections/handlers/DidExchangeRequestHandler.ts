import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DidRepository } from '../../dids/repository'
import type { OutOfBandService } from '../../oob/OutOfBandService'
import type { RoutingService } from '../../routing/services/RoutingService'
import type { ConnectionsModuleConfig } from '../ConnectionsModuleConfig'
import type { DidExchangeProtocol } from '../DidExchangeProtocol'

import { OutboundMessageContext } from '../../../agent/models'
import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { OutOfBandRole } from '../../oob/domain'
import { OutOfBandState } from '../../oob/domain/OutOfBandState'
import { OutOfBandInvitation } from '../../oob/messages'
import { OutOfBandRecord } from '../../oob/repository'
import { DidExchangeRequestMessage } from '../messages'

export class DidExchangeRequestHandler implements Handler {
  private didExchangeProtocol: DidExchangeProtocol
  private outOfBandService: OutOfBandService
  private routingService: RoutingService
  private didRepository: DidRepository
  private connectionsModuleConfig: ConnectionsModuleConfig
  public supportedMessages = [DidExchangeRequestMessage]

  public constructor(
    didExchangeProtocol: DidExchangeProtocol,
    outOfBandService: OutOfBandService,
    routingService: RoutingService,
    didRepository: DidRepository,
    connectionsModuleConfig: ConnectionsModuleConfig
  ) {
    this.didExchangeProtocol = didExchangeProtocol
    this.outOfBandService = outOfBandService
    this.routingService = routingService
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

    const createOobRecord = async () => {
      const outOfBandRecord = new OutOfBandRecord({
        role: OutOfBandRole.Sender,
        state: OutOfBandState.AwaitResponse,
        alias: 'config.alias',
        reusable: true,
        autoAcceptConnection: messageContext.agentContext.config.autoAcceptConnections,
      })

      await this.outOfBandService.save(messageContext.agentContext, outOfBandRecord)
      this.outOfBandService.emitStateChangedEvent(messageContext.agentContext, outOfBandRecord, null)
      return outOfBandRecord
    }

    const outOfBandRecord =
      message.thread?.parentThreadId === 'publicDID'
        ? await createOobRecord()
        : await this.outOfBandService.findByInvitationId(messageContext.agentContext, message.thread.parentThreadId)
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
        ? await this.routingService.getRouting(messageContext.agentContext)
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
