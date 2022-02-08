import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { ProofResponseCoordinator } from '../../../ProofResponseCoordinator'

import { V1ProposePresentationMessage } from '../messages'
import { V1ProofService } from '..'
import { DidCommMessageRepository } from '../../../../../storage/didcomm/DidCommMessageRepository'
import { createOutboundMessage } from '../../../../../agent/helpers'
import { ProofProtocolVersion } from '../../../models/ProofProtocolVersion'
import { ProofRecord } from '../../../repository/ProofRecord'

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
      return
    }

    const proposalMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: proofRecord.id,
      messageClass: V1ProposePresentationMessage,
    })

    if (!proposalMessage) {
      this.agentConfig.logger.error(`Proof record with id ${proofRecord.id} is missing required credential proposal`)
      return
    }
    const proofRequest = await this.proofService.createProofRequestFromProposal(proposalMessage.presentationProposal, {
      name: 'proof-request',
      version: '1.0',
    })

    const { message } = await this.proofService.createRequestAsResponse({
      proofFormats: {
        indy: {
          name: proofRequest.name,
          version: proofRequest.version,
          nonRevoked: proofRequest.nonRevoked,
          requestedAttributes: proofRequest.requestedAttributes,
          requestedPredicates: proofRequest.requestedPredicates,
          ver: proofRequest.ver,
          proofRequest: proofRequest,
          nonce: proofRequest.nonce,
        },
      },
      proofRecord: proofRecord,
      protocolVersion: ProofProtocolVersion.V1_0,
      autoAcceptProof: proofRecord.autoAcceptProof,
      // Not sure to what to do with goalCode, willConfirm and comment fields here
    })

    return createOutboundMessage(messageContext.connection, message)
  }
}
