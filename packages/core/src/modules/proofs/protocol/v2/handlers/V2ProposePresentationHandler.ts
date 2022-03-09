import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { ProofResponseCoordinator } from '../../../ProofResponseCoordinator'
import type { ProofRecord } from '../../../repository/ProofRecord'
import type { V2ProofService } from '../V2ProofService'

import { createOutboundMessage } from '../../../../../agent/helpers'
import { AriesFrameworkError } from '../../../../../error/AriesFrameworkError'
import { ProofProtocolVersion } from '../../../models/ProofProtocolVersion'
import { V2ProposalPresentationMessage } from '../messages/V2ProposalPresentationMessage'

export class V2ProposePresentationHandler implements Handler {
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

    if (this.proofResponseCoordinator.shouldAutoRespondToProposal(proofRecord)) {
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
      return
    }

    const proposalMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: proofRecord.id,
      messageClass: V2ProposalPresentationMessage,
    })

    if (!proposalMessage) {
      this.agentConfig.logger.error(`Proof record with id ${proofRecord.id} is missing required credential proposal`)
      return
    }

    const proofRequestsOptions = {
      name: 'proof-request',
      version: '1.0',
    }

    const proposalAttachment = proposalMessage.getAttachmentById('hlindy/proof-req@v2.0')

    if (!proposalAttachment) {
      throw new AriesFrameworkError('No proposal message could be found')
    }

    const proofRequest = await this.proofService.createProofRequestFromProposal({
      formats: {
        indy: {
          proofRecord: proofRecord,
        },
      },
      config: {
        indy: proofRequestsOptions,
      },
    })

    if (!proofRequest.indy) {
      throw new AriesFrameworkError('Failed to create proof request')
    }

    const { message } = await this.proofService.createRequestAsResponse({
      proofRecord: proofRecord,
      protocolVersion: ProofProtocolVersion.V2_0,
      autoAcceptProof: proofRecord.autoAcceptProof,
      proofFormats: {
        indy: {
          name: proofRequest.indy.name,
          nonce: proofRequest.indy.nonce,
          version: proofRequest.indy.version,
          nonRevoked: proofRequest.indy.nonRevoked,
          requestedAttributes: proofRequest.indy.requestedAttributes,
          requestedPredicates: proofRequest.indy.requestedPredicates,
          ver: proofRequest.indy.ver,
          proofRequest: proofRequest.indy,
        },
      },
    })

    return createOutboundMessage(messageContext.connection, message)
  }
}
