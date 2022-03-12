import type { V1ProofService } from '..'
import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { DidCommMessageRepository } from '../../../../../storage/didcomm/DidCommMessageRepository'
import type { ProofResponseCoordinator } from '../../../ProofResponseCoordinator'
import type { ProofRecord } from '../../../repository/ProofRecord'

import { createOutboundMessage } from '../../../../../agent/helpers'
import { AriesFrameworkError } from '../../../../../error/AriesFrameworkError'
import { ProofProtocolVersion } from '../../../models/ProofProtocolVersion'
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
    const proofRequest = await this.proofService.createProofRequestFromProposal({
      formats: {
        indy: {
          proofRecord: proofRecord,
        },
      },
      config: {
        indy: {
          name: 'proof request',
          version: '1.0',
          nonce: await this.proofService.generateProofRequestNonce(),
        },
      },
    })

    const indyProofRequest = proofRequest.indy

    if (!indyProofRequest) {
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
      protocolVersion: ProofProtocolVersion.V1_0,
      autoAcceptProof: proofRecord.autoAcceptProof,
      // Not sure to what to do with goalCode, willConfirm and comment fields here
    })

    return createOutboundMessage(messageContext.connection, message)
  }
}
