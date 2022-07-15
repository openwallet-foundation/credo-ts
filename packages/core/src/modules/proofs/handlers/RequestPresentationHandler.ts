import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { Logger } from '../../../logger'
import type { RoutingService } from '../../routing/services/RoutingService'
import type { ProofResponseCoordinator } from '../ProofResponseCoordinator'
import type { ProofRecord } from '../repository'
import type { ProofService } from '../services'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../agent/helpers'
import { ServiceDecorator } from '../../../decorators/service/ServiceDecorator'
import { RequestPresentationMessage } from '../messages'

export class RequestPresentationHandler implements Handler {
  private proofService: ProofService
  private proofResponseCoordinator: ProofResponseCoordinator
  private routingService: RoutingService
  private logger: Logger
  public supportedMessages = [RequestPresentationMessage]

  public constructor(
    proofService: ProofService,
    proofResponseCoordinator: ProofResponseCoordinator,
    routingService: RoutingService,
    logger: Logger
  ) {
    this.proofService = proofService
    this.proofResponseCoordinator = proofResponseCoordinator
    this.routingService = routingService
    this.logger = logger
  }

  public async handle(messageContext: HandlerInboundMessage<RequestPresentationHandler>) {
    const proofRecord = await this.proofService.processRequest(messageContext)

    if (this.proofResponseCoordinator.shouldAutoRespondToRequest(messageContext.agentContext, proofRecord)) {
      return await this.createPresentation(proofRecord, messageContext)
    }
  }

  private async createPresentation(
    record: ProofRecord,
    messageContext: HandlerInboundMessage<RequestPresentationHandler>
  ) {
    const indyProofRequest = record.requestMessage?.indyProofRequest
    const presentationProposal = record.proposalMessage?.presentationProposal

    this.logger.info(`Automatically sending presentation with autoAccept`)

    if (!indyProofRequest) {
      this.logger.error('Proof request is undefined.')
      return
    }

    const retrievedCredentials = await this.proofService.getRequestedCredentialsForProofRequest(
      messageContext.agentContext,
      indyProofRequest,
      {
        presentationProposal,
      }
    )

    const requestedCredentials = this.proofService.autoSelectCredentialsForProofRequest(retrievedCredentials)

    const { message, proofRecord } = await this.proofService.createPresentation(
      messageContext.agentContext,
      record,
      requestedCredentials
    )

    if (messageContext.connection) {
      return createOutboundMessage(messageContext.connection, message)
    } else if (proofRecord.requestMessage?.service) {
      // Create ~service decorator
      const routing = await this.routingService.getRouting(messageContext.agentContext)
      const ourService = new ServiceDecorator({
        serviceEndpoint: routing.endpoints[0],
        recipientKeys: [routing.recipientKey.publicKeyBase58],
        routingKeys: routing.routingKeys.map((key) => key.publicKeyBase58),
      })

      const recipientService = proofRecord.requestMessage.service

      // Set and save ~service decorator to record (to remember our verkey)
      message.service = ourService
      proofRecord.presentationMessage = message
      await this.proofService.update(messageContext.agentContext, proofRecord)

      return createOutboundServiceMessage({
        payload: message,
        service: recipientService.resolvedDidCommService,
        senderKey: ourService.resolvedDidCommService.recipientKeys[0],
      })
    }

    this.logger.error(`Could not automatically create presentation`)
  }
}
