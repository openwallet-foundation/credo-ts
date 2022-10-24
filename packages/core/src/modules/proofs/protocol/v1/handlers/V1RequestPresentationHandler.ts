import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { DidCommMessageRepository } from '../../../../../storage/didcomm/DidCommMessageRepository'
import type { MediationRecipientService, RoutingService } from '../../../../routing'
import type { ProofResponseCoordinator } from '../../../ProofResponseCoordinator'
import type { IndyProofFormat } from '../../../formats/indy/IndyProofFormat'
import type {
  FormatRequestedCredentialReturn,
  FormatRetrievedCredentialOptions,
} from '../../../models/ProofServiceOptions'
import type { ProofRecord } from '../../../repository/ProofRecord'
import type { V1ProofService } from '../V1ProofService'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../../../agent/helpers'
import { ServiceDecorator } from '../../../../../decorators/service/ServiceDecorator'
import { AriesFrameworkError } from '../../../../../error'
import { DidCommMessageRole } from '../../../../../storage'
import { V1RequestPresentationMessage } from '../messages'

export class V1RequestPresentationHandler implements Handler {
  private proofService: V1ProofService
  private agentConfig: AgentConfig
  private proofResponseCoordinator: ProofResponseCoordinator
  private mediationRecipientService: MediationRecipientService
  private didCommMessageRepository: DidCommMessageRepository
  private routingService: RoutingService
  public supportedMessages = [V1RequestPresentationMessage]

  public constructor(
    proofService: V1ProofService,
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

  public async handle(messageContext: HandlerInboundMessage<V1RequestPresentationHandler>) {
    const proofRecord = await this.proofService.processRequest(messageContext)
    if (this.proofResponseCoordinator.shouldAutoRespondToRequest(messageContext.agentContext, proofRecord)) {
      return await this.createPresentation(proofRecord, messageContext)
    }
  }

  private async createPresentation(
    record: ProofRecord,
    messageContext: HandlerInboundMessage<V1RequestPresentationHandler>
  ) {
    const requestMessage = await this.didCommMessageRepository.getAgentMessage(messageContext.agentContext, {
      associatedRecordId: record.id,
      messageClass: V1RequestPresentationMessage,
    })

    const indyProofRequest = requestMessage.indyProofRequest

    this.agentConfig.logger.info(
      `Automatically sending presentation with autoAccept on ${this.agentConfig.autoAcceptProofs}`
    )

    if (!indyProofRequest) {
      this.agentConfig.logger.error('Proof request is undefined.')
      throw new AriesFrameworkError('No proof request found.')
    }

    const retrievedCredentials: FormatRetrievedCredentialOptions<[IndyProofFormat]> =
      await this.proofService.getRequestedCredentialsForProofRequest(messageContext.agentContext, {
        proofRecord: record,
        config: {
          filterByPresentationPreview: true,
        },
      })
    if (!retrievedCredentials.proofFormats.indy) {
      this.agentConfig.logger.error('No matching Indy credentials could be retrieved.')
      throw new AriesFrameworkError('No matching Indy credentials could be retrieved.')
    }

    const options: FormatRetrievedCredentialOptions<[IndyProofFormat]> = {
      proofFormats: retrievedCredentials.proofFormats,
    }
    const requestedCredentials: FormatRequestedCredentialReturn<[IndyProofFormat]> =
      await this.proofService.autoSelectCredentialsForProofRequest(options)

    const { message, proofRecord } = await this.proofService.createPresentation(messageContext.agentContext, {
      proofRecord: record,
      proofFormats: {
        indy: requestedCredentials.proofFormats.indy,
      },
      willConfirm: true,
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
