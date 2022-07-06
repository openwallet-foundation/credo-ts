import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { Logger } from '../../../logger'
import type { ProofResponseCoordinator } from '../ProofResponseCoordinator'
import type { ProofRecord } from '../repository'
import type { ProofService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { ProposePresentationMessage } from '../messages'

export class ProposePresentationHandler implements Handler {
  private proofService: ProofService
  private proofResponseCoordinator: ProofResponseCoordinator
  private logger: Logger
  public supportedMessages = [ProposePresentationMessage]

  public constructor(proofService: ProofService, proofResponseCoordinator: ProofResponseCoordinator, logger: Logger) {
    this.proofService = proofService
    this.proofResponseCoordinator = proofResponseCoordinator
    this.logger = logger
  }

  public async handle(messageContext: HandlerInboundMessage<ProposePresentationHandler>) {
    const proofRecord = await this.proofService.processProposal(messageContext)

    if (this.proofResponseCoordinator.shouldAutoRespondToProposal(messageContext.agentContext, proofRecord)) {
      return await this.createRequest(proofRecord, messageContext)
    }
  }

  private async createRequest(
    proofRecord: ProofRecord,
    messageContext: HandlerInboundMessage<ProposePresentationHandler>
  ) {
    this.logger.info(
      `Automatically sending request with autoAccept on ${messageContext.agentContext.config.autoAcceptProofs}`
    )

    if (!messageContext.connection) {
      this.logger.error('No connection on the messageContext')
      return
    }
    if (!proofRecord.proposalMessage) {
      this.logger.error(`Proof record with id ${proofRecord.id} is missing required credential proposal`)
      return
    }
    const proofRequest = await this.proofService.createProofRequestFromProposal(
      messageContext.agentContext,
      proofRecord.proposalMessage.presentationProposal,
      {
        name: 'proof-request',
        version: '1.0',
      }
    )

    const { message } = await this.proofService.createRequestAsResponse(
      messageContext.agentContext,
      proofRecord,
      proofRequest
    )

    return createOutboundMessage(messageContext.connection, message)
  }
}
