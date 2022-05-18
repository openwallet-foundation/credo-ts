import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { DidCommMessageRepository } from '../../../../../storage/didcomm/DidCommMessageRepository'
import type { MediationRecipientService } from '../../../../routing'
import type { ProofResponseCoordinator } from '../../../ProofResponseCoordinator'
import type { ProofRecord } from '../../../repository/ProofRecord'
import type { V1ProofService } from '../V1ProofService'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../../../agent/helpers'
import { ServiceDecorator } from '../../../../../decorators/service/ServiceDecorator'
import { DidCommMessageRole } from '../../../../../storage'
import { ProofProtocolVersion } from '../../../models/ProofProtocolVersion'
import { V1RequestPresentationMessage } from '../messages'

export class V1RequestPresentationHandler implements Handler {
  private proofService: V1ProofService
  private agentConfig: AgentConfig
  private proofResponseCoordinator: ProofResponseCoordinator
  private mediationRecipientService: MediationRecipientService
  private didCommMessageRepository: DidCommMessageRepository
  public supportedMessages = [V1RequestPresentationMessage]

  public constructor(
    proofService: V1ProofService,
    agentConfig: AgentConfig,
    proofResponseCoordinator: ProofResponseCoordinator,
    mediationRecipientService: MediationRecipientService,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    this.proofService = proofService
    this.agentConfig = agentConfig
    this.proofResponseCoordinator = proofResponseCoordinator
    this.mediationRecipientService = mediationRecipientService
    this.didCommMessageRepository = didCommMessageRepository
  }

  public async handle(messageContext: HandlerInboundMessage<V1RequestPresentationHandler>) {
    const proofRecord = await this.proofService.processRequest(messageContext)
    if (this.proofResponseCoordinator.shouldAutoRespondToRequest(proofRecord)) {
      return await this.createPresentation(proofRecord, messageContext)
    }
  }

  private async createPresentation(
    record: ProofRecord,
    messageContext: HandlerInboundMessage<V1RequestPresentationHandler>
  ) {
    const requestMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: record.id,
      messageClass: V1RequestPresentationMessage,
    })

    const indyProofRequest = requestMessage.indyProofRequest

    this.agentConfig.logger.info(
      `Automatically sending presentation with autoAccept on ${this.agentConfig.autoAcceptProofs}`
    )

    if (!indyProofRequest) {
      this.agentConfig.logger.error('Proof request is undefined.')
      return
    }

    const retrievedCredentials = await this.proofService.getRequestedCredentialsForProofRequest({
      proofRecord: record,
      config: {
        filterByPresentationPreview: false,
      },
    })

    if (!retrievedCredentials.indy) {
      this.agentConfig.logger.error('No matching Indy credentials could be retrieved.')
      return
    }

    const requestedCredentials = await this.proofService.autoSelectCredentialsForProofRequest({
      indy: retrievedCredentials.indy,
    })

    const { message, proofRecord } = await this.proofService.createPresentation({
      proofRecord: record,
      proofFormats: {
        indy: requestedCredentials.indy,
      },
      protocolVersion: ProofProtocolVersion.V1,
      willConfirm: true,
    })

    if (messageContext.connection) {
      return createOutboundMessage(messageContext.connection, message)
    } else if (requestMessage.service) {
      // Create ~service decorator
      const routing = await this.mediationRecipientService.getRouting()
      const ourService = new ServiceDecorator({
        serviceEndpoint: routing.endpoints[0],
        recipientKeys: [routing.verkey],
        routingKeys: routing.routingKeys,
      })

      const recipientService = requestMessage.service

      // Set and save ~service decorator to record (to remember our verkey)
      message.service = ourService

      await this.didCommMessageRepository.saveOrUpdateAgentMessage({
        agentMessage: message,
        associatedRecordId: proofRecord.id,
        role: DidCommMessageRole.Sender,
      })

      return createOutboundServiceMessage({
        payload: message,
        service: recipientService.resolvedDidCommService,
        senderKey: ourService.resolvedDidCommService.recipientKeys[0],
      })
    }

    this.agentConfig.logger.error(`Could not automatically create presentation`)
  }
}
