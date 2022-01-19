import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { ProofResponseCoordinator } from '../../../ProofResponseCoordinator'
import type { V1LegacyProofService } from '../V1LegacyProofService'

import { ProposePresentationMessage } from '../messages'

export class ProposePresentationHandler implements Handler {
  private proofService: V1LegacyProofService
  private agentConfig: AgentConfig
  private proofResponseCoordinator: ProofResponseCoordinator
  public supportedMessages = [ProposePresentationMessage]

  public constructor(
    proofService: V1LegacyProofService,
    agentConfig: AgentConfig,
    proofResponseCoordinator: ProofResponseCoordinator
  ) {
    this.proofService = proofService
    this.agentConfig = agentConfig
    this.proofResponseCoordinator = proofResponseCoordinator
  }

  public async handle(messageContext: HandlerInboundMessage<ProposePresentationHandler>) {
    const proofRecord = await this.proofService.processProposal(messageContext)
    if (this.proofResponseCoordinator.shouldAutoRespondToProposal(proofRecord)) {
      //   return await this.createRequest(proofRecord, messageContext)
    }
  }

  // private async createRequest(
  //   proofRecord: ProofRecord,
  //   messageContext: HandlerInboundMessage<ProposePresentationHandler>
  // ) {
  //   this.agentConfig.logger.info(
  //     `Automatically sending request with autoAccept on ${this.agentConfig.autoAcceptProofs}`
  //   )

  //   if (!messageContext.connection) {
  //     this.agentConfig.logger.error('No connection on the messageContext')
  //     return
  //   }
  //   if (!proofRecord.proposalMessage) {
  //     this.agentConfig.logger.error(`Proof record with id ${proofRecord.id} is missing required credential proposal`)
  //     return
  //   }
  //   const proofRequest = await this.proofService.createProofRequestFromProposal(
  //     proofRecord.proposalMessage?.presentationProposal,
  //     {
  //       name: 'proof-request',
  //       version: '1.0',
  //     }
  //   )

  //   const { message } = await this.proofService.createRequestAsResponse(proofRecord, proofRequest)

  //   return createOutboundMessage(messageContext.connection, message)
  // }
}
