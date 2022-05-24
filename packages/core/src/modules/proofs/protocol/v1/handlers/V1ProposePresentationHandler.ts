import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { DidCommMessageRepository } from '../../../../../storage/didcomm/DidCommMessageRepository'
import type { ProofResponseCoordinator } from '../../../ProofResponseCoordinator'
import type { ProofRequestFromProposalOptions } from '../../../models/ProofServiceOptions'
import type { ProofRecord } from '../../../repository/ProofRecord'
import type { V1ProofService } from '../V1ProofService'

import { createOutboundMessage } from '../../../../../agent/helpers'
import { AriesFrameworkError } from '../../../../../error'
import { V1ProposePresentationMessage } from '../messages'

export class V1ProposePresentationHandler implements Handler {
  private proofService: V1ProofService
  private agentConfig: AgentConfig
  private didCommMessageRepository: DidCommMessageRepository
  private proofResponseCoordinator: ProofResponseCoordinator
  public supportedMessages = [V1ProposePresentationMessage]

  public constructor(
    proofService: V1ProofService,
    agentConfig: AgentConfig,
    proofResponseCoordinator: ProofResponseCoordinator,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    this.proofService = proofService
    this.agentConfig = agentConfig
    this.proofResponseCoordinator = proofResponseCoordinator
    this.didCommMessageRepository = didCommMessageRepository
  }

  public async handle(messageContext: HandlerInboundMessage<V1ProposePresentationHandler>) {
    const proofRecord = await this.proofService.processProposal(messageContext)
    if (this.proofResponseCoordinator.shouldAutoRespondToProposal(proofRecord)) {
      return await this.createRequest(proofRecord, messageContext)
    }
  }

  private async createRequest(
    proofRecord: ProofRecord,
    messageContext: HandlerInboundMessage<V1ProposePresentationHandler>
  ) {
    this.agentConfig.logger.info(
      `Automatically sending request with autoAccept on ${this.agentConfig.autoAcceptProofs}`
    )

    if (!messageContext.connection) {
      this.agentConfig.logger.error('No connection on the messageContext')
      throw new AriesFrameworkError('No connection on the messageContext')
    }

    const proposalMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: proofRecord.id,
      messageClass: V1ProposePresentationMessage,
    })

    if (!proposalMessage) {
      this.agentConfig.logger.error(`Proof record with id ${proofRecord.id} is missing required credential proposal`)
      throw new AriesFrameworkError(`Proof record with id ${proofRecord.id} is missing required credential proposal`)
    }

    const proofRequestFromProposalOptions: ProofRequestFromProposalOptions = {
      name: 'proof-request',
      version: '1.0',
      nonce: await this.proofService.generateProofRequestNonce(),
      proofRecord,
    }

    const proofRequest = await this.proofService.createProofRequestFromProposal(proofRequestFromProposalOptions)

    const indyProofRequest = proofRequest.indy

    if (!indyProofRequest) {
      this.agentConfig.logger.error(`No Indy proof request was found`)
      throw new AriesFrameworkError('No Indy proof request was found')
    }

    const { message } = await this.proofService.createRequestAsResponse({
      proofFormats: {
        indy: {
          name: indyProofRequest.name,
          version: indyProofRequest.version,
          nonRevoked: indyProofRequest.nonRevoked,
          requestedAttributes: indyProofRequest.requestedAttributes,
          requestedPredicates: indyProofRequest.requestedPredicates,
          ver: indyProofRequest.ver,
          proofRequest: indyProofRequest,
          nonce: indyProofRequest.nonce,
        },
      },
      proofRecord: proofRecord,
      autoAcceptProof: proofRecord.autoAcceptProof,
      willConfirm: true,
    })

    return createOutboundMessage(messageContext.connection, message)
  }
}
