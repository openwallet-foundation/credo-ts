import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { DidCommMessageRepository } from '../../../../../storage/didcomm/DidCommMessageRepository'
import type { MediationRecipientService, RoutingService } from '../../../../routing'
import type { ProofResponseCoordinator } from '../../../ProofResponseCoordinator'
import type { ProofFormat } from '../../../formats/ProofFormat'
import type {
  CreatePresentationOptions,
  FormatRequestedCredentialReturn,
  FormatRetrievedCredentialOptions,
} from '../../../models/ProofServiceOptions'
import type { ProofRecord } from '../../../repository/ProofRecord'
import type { V2ProofService } from '../V2ProofService'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../../../agent/helpers'
import { ServiceDecorator } from '../../../../../decorators/service/ServiceDecorator'
import { DidCommMessageRole } from '../../../../../storage'
import { V2RequestPresentationMessage } from '../messages/V2RequestPresentationMessage'

export class V2RequestPresentationHandler<PFs extends ProofFormat[] = ProofFormat[]> implements Handler {
  private proofService: V2ProofService
  private agentConfig: AgentConfig
  private proofResponseCoordinator: ProofResponseCoordinator
  private mediationRecipientService: MediationRecipientService
  private didCommMessageRepository: DidCommMessageRepository
  private routingService: RoutingService
  public supportedMessages = [V2RequestPresentationMessage]

  public constructor(
    proofService: V2ProofService,
    agentConfig: AgentConfig,
    proofResponseCoordinator: ProofResponseCoordinator,
    mediationRecipientService: MediationRecipientService,
    didCommMessageRepository: DidCommMessageRepository,
    routingService: RoutingService
  ) {
    this.proofService = proofService
    this.agentConfig = agentConfig
    this.proofResponseCoordinator = proofResponseCoordinator
    this.mediationRecipientService = mediationRecipientService
    this.didCommMessageRepository = didCommMessageRepository
    this.routingService = routingService
  }

  public async handle(messageContext: HandlerInboundMessage<V2RequestPresentationHandler>) {
    const proofRecord = await this.proofService.processRequest(messageContext)
    if (this.proofResponseCoordinator.shouldAutoRespondToRequest(messageContext.agentContext, proofRecord)) {
      return await this.createPresentation(proofRecord, messageContext)
    }
  }

  private async createPresentation(
    record: ProofRecord,
    messageContext: HandlerInboundMessage<V2RequestPresentationHandler>
  ) {
    const requestMessage = await this.didCommMessageRepository.getAgentMessage(messageContext.agentContext, {
      associatedRecordId: record.id,
      messageClass: V2RequestPresentationMessage,
    })

    this.agentConfig.logger.info(
      `Automatically sending presentation with autoAccept on ${this.agentConfig.autoAcceptProofs}`
    )

    const retrievedCredentials: FormatRetrievedCredentialOptions<PFs> =
      await this.proofService.getRequestedCredentialsForProofRequest(messageContext.agentContext, {
        proofRecord: record,
        config: {
          filterByPresentationPreview: false,
        },
      })

    const requestedCredentials: FormatRequestedCredentialReturn<PFs> =
      await this.proofService.autoSelectCredentialsForProofRequest(retrievedCredentials)

    const { message, proofRecord } = await this.proofService.createPresentation(messageContext.agentContext, {
      proofRecord: record,
      proofFormats: requestedCredentials.proofFormats,
    })

    if (messageContext.connection) {
      return createOutboundMessage(messageContext.connection, message)
    } else if (requestMessage.service) {
      const routing = await this.routingService.getRouting(messageContext.agentContext)
      message.service = new ServiceDecorator({
        serviceEndpoint: routing.endpoints[0],
        recipientKeys: [routing.recipientKey.publicKeyBase58],
        routingKeys: routing.routingKeys.map((key) => key.publicKeyBase58),
      })
      const recipientService = requestMessage.service

      await this.didCommMessageRepository.saveOrUpdateAgentMessage(messageContext.agentContext, {
        agentMessage: message,
        associatedRecordId: proofRecord.id,
        role: DidCommMessageRole.Sender,
      })

      return createOutboundServiceMessage({
        payload: message,
        service: recipientService.resolvedDidCommService,
        senderKey: message.service.resolvedDidCommService.recipientKeys[0],
      })
    }

    this.agentConfig.logger.error(`Could not automatically create presentation`)
  }
}
