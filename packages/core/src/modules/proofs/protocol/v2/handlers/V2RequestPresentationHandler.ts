import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { DidCommMessageRepository } from '../../../../../storage/didcomm/DidCommMessageRepository'
import type { MediationRecipientService } from '../../../../routing'
import type { ProofResponseCoordinator } from '../../../ProofResponseCoordinator'
import type { ProofRecord } from '../../../repository/ProofRecord'
import type { V2ProofService } from '../V2ProofService'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../../../agent/helpers'
import { ServiceDecorator } from '../../../../../decorators/service/ServiceDecorator'
import { DidCommMessageRole } from '../../../../../storage'
import { ProofProtocolVersion } from '../../../models/ProofProtocolVersion'
import { V2RequestPresentationMessage } from '../messages/V2RequestPresentationMessage'

export class V2RequestPresentationHandler implements Handler {
  private proofService: V2ProofService
  private agentConfig: AgentConfig
  private proofResponseCoordinator: ProofResponseCoordinator
  private mediationRecipientService: MediationRecipientService
  private didCommMessageRepository: DidCommMessageRepository
  public supportedMessages = [V2RequestPresentationMessage]

  public constructor(
    proofService: V2ProofService,
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

  public async handle(messageContext: HandlerInboundMessage<V2RequestPresentationHandler>) {
    const proofRecord = await this.proofService.processRequest(messageContext)
    if (this.proofResponseCoordinator.shouldAutoRespondToRequest(proofRecord)) {
      return await this.createPresentation(proofRecord, messageContext)
    }
  }

  private async createPresentation(
    record: ProofRecord,
    messageContext: HandlerInboundMessage<V2RequestPresentationHandler>
  ) {
    const requestMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: record.id,
      messageClass: V2RequestPresentationMessage,
    })

    this.agentConfig.logger.info(
      `Automatically sending presentation with autoAccept on ${this.agentConfig.autoAcceptProofs}`
    )

    const retrievedCredentials = await this.proofService.getRequestedCredentialsForProofRequest({
      proofRecord: record,
      config: {
        filterByPresentationPreview: false,
      },
    })

    const requestedCredentials = await this.proofService.autoSelectCredentialsForProofRequest(retrievedCredentials)

    const { message, proofRecord } = await this.proofService.createPresentation({
      proofRecord: record,
      proofFormats: {
        indy: requestedCredentials.indy,
      },
      protocolVersion: ProofProtocolVersion.V2,
      // Not sure to what to do with goalCode, willConfirm and comment fields here
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
        service: recipientService.toDidCommService(),
        senderKey: ourService.recipientKeys[0],
      })
    }

    this.agentConfig.logger.error(`Could not automatically create presentation`)
  }
}
