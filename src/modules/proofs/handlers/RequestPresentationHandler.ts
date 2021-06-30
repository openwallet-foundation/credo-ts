import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { ProofRecord } from '../repository'
import type { ProofService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { AutoAcceptProof } from '../../../types'
import { ProofUtils } from '../ProofUtils'
import { RequestPresentationMessage } from '../messages'

export class RequestPresentationHandler implements Handler {
  private proofService: ProofService
  private agentConfig: AgentConfig
  public supportedMessages = [RequestPresentationMessage]

  public constructor(proofService: ProofService, agentConfig: AgentConfig) {
    this.proofService = proofService
    this.agentConfig = agentConfig
  }

  public async handle(messageContext: HandlerInboundMessage<RequestPresentationHandler>) {
    const proofRecord = await this.proofService.processRequest(messageContext)

    const autoAccept = ProofUtils.composeAutoAccept(proofRecord.autoAcceptProof, this.agentConfig.autoAcceptProofs)

    if (autoAccept === AutoAcceptProof.always) {
      return await this.nextStep(proofRecord, messageContext)
    }
  }

  private async nextStep(proofRecord: ProofRecord, messageContext: HandlerInboundMessage<RequestPresentationHandler>) {
    const indyProofRequest = proofRecord.requestMessage?.indyProofRequest

    if (indyProofRequest) {
      const retrievedCredentials = await this.proofService.getRequestedCredentialsForProofRequest(
        indyProofRequest,
        proofRecord.proposalMessage?.presentationProposal
      )

      const requestedCredentials = this.proofService.autoSelectCredentialsForProofRequest(retrievedCredentials)

      const { message } = await this.proofService.createPresentation(proofRecord, requestedCredentials)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return createOutboundMessage(messageContext.connection!, message)
    }
  }
}
