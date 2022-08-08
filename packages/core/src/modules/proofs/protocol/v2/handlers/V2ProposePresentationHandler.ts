import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { ProofResponseCoordinator } from '../../../ProofResponseCoordinator'
import type { ProofFormat } from '../../../formats/ProofFormat'
import type {
  CreateProofRequestFromProposalOptions,
  CreateRequestAsResponseOptions,
  ProofRequestFromProposalOptions,
} from '../../../models/ProofServiceOptions'
import type { ProofRecord } from '../../../repository/ProofRecord'
import type { V2ProofService } from '../V2ProofService'

import { createOutboundMessage } from '../../../../../agent/helpers'
import { AriesFrameworkError } from '../../../../../error/AriesFrameworkError'
import { V2ProposalPresentationMessage } from '../messages/V2ProposalPresentationMessage'

export class V2ProposePresentationHandler<PFs extends ProofFormat[] = ProofFormat[]> implements Handler {
  private proofService: V2ProofService
  private agentConfig: AgentConfig
  private didCommMessageRepository: DidCommMessageRepository
  private proofResponseCoordinator: ProofResponseCoordinator
  public supportedMessages = [V2ProposalPresentationMessage]

  public constructor(
    proofService: V2ProofService,
    agentConfig: AgentConfig,
    didCommMessageRepository: DidCommMessageRepository,
    proofResponseCoordinator: ProofResponseCoordinator
  ) {
    this.proofService = proofService
    this.agentConfig = agentConfig
    this.didCommMessageRepository = didCommMessageRepository
    this.proofResponseCoordinator = proofResponseCoordinator
  }

  public async handle(messageContext: HandlerInboundMessage<V2ProposePresentationHandler>) {
    const proofRecord = await this.proofService.processProposal(messageContext)

    if (this.proofResponseCoordinator.shouldAutoRespondToProposal(messageContext.agentContext, proofRecord)) {
      return this.createRequest(proofRecord, messageContext)
    }
  }

  private async createRequest(
    proofRecord: ProofRecord,
    messageContext: HandlerInboundMessage<V2ProposePresentationHandler>
  ) {
    this.agentConfig.logger.info(
      `Automatically sending request with autoAccept on ${this.agentConfig.autoAcceptProofs}`
    )

    if (!messageContext.connection) {
      this.agentConfig.logger.error('No connection on the messageContext')
      throw new AriesFrameworkError('No connection on the messageContext')
    }

    const proposalMessage = await this.didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V2ProposalPresentationMessage,
    })

    if (!proposalMessage) {
      this.agentConfig.logger.error(`Proof record with id ${proofRecord.id} is missing required credential proposal`)
      throw new AriesFrameworkError(`Proof record with id ${proofRecord.id} is missing required credential proposal`)
    }

    const proofRequestFromProposalOptions: CreateProofRequestFromProposalOptions = {
      proofRecord,
    }

    const proofRequest: ProofRequestFromProposalOptions<PFs> = await this.proofService.createProofRequestFromProposal(
      messageContext.agentContext,
      proofRequestFromProposalOptions
    )

    const indyProofRequest = proofRequest.proofFormats

    if (!indyProofRequest) {
      this.agentConfig.logger.error('Failed to create proof request')
      throw new AriesFrameworkError('Failed to create proof request.')
    }

    const options: CreateRequestAsResponseOptions<PFs> = {
      proofRecord: proofRecord,
      autoAcceptProof: proofRecord.autoAcceptProof,
      proofFormats: indyProofRequest,
      willConfirm: true,
    }

    const { message } = await this.proofService.createRequestAsResponse(messageContext.agentContext, options)

    return createOutboundMessage(messageContext.connection, message)
  }
}
